"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import postgres from "postgres";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { randomUUID } from "crypto";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET } from "@/app/lib/s3";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: "Please select a customer.",
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: "Please enter an amount greater than $0." }),
  status: z.enum(["pending", "paid"], {
    invalid_type_error: "Please select an invoice status.",
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Create Invoice",
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split("T")[0];

  try {
    await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    console.log(error);
    return {
      message: "Database Error: Failed to Create Invoice.",
    };
  }
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

// ...

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Update Invoice",
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;

  try {
    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
  } catch (error) {
    console.log(error);
    return {
      message: "Database Error: Failed to Update Invoice.",
    };
  }
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath("/dashboard/invoices");
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid credentials.";
        default:
          return "Something went wrong.";
      }
    }
    throw error;
  }
}

// ---------- Customers ----------

const DEFAULT_AVATAR = "/customers/default.png";
const MAX_AVATAR_BYTES = 1024 * 1024; // 1 MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const CustomerFormSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, { message: "Please enter a name." }),
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address." }),
});

const CreateCustomer = CustomerFormSchema.omit({ id: true });

export type CustomerState = {
  errors?: {
    name?: string[];
    email?: string[];
    image?: string[];
  };
  message?: string | null;
};

export async function createCustomer(
  prevState: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const validatedFields = CreateCustomer.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing or invalid fields. Failed to create customer.",
    };
  }

  const { name, email } = validatedFields.data;

  let imageUrl = DEFAULT_AVATAR;
  const file = formData.get("image");

  if (file instanceof File && file.size > 0) {
    const extension = ALLOWED_TYPES[file.type];
    if (!extension) {
      return {
        errors: { image: ["Please upload a PNG, JPEG or WebP image."] },
        message: "Failed to create customer.",
      };
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return {
        errors: { image: ["The image must be smaller than 1 MB."] },
        message: "Failed to create customer.",
      };
    }

    const key = `${randomUUID()}.${extension}`;
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: Buffer.from(await file.arrayBuffer()),
          ContentType: file.type,
        }),
      );
    } catch (error) {
      console.log(error);
      return { message: "Upload failed. Please try again." };
    }
    imageUrl = `/api/avatars/${key}`;
  }

  try {
    await sql`
      INSERT INTO customers (name, email, image_url)
      VALUES (${name}, ${email}, ${imageUrl})
    `;
  } catch (error) {
    console.log(error);
    return { message: "Database error: failed to create customer." };
  }

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
  redirect("/dashboard/customers");
}

const UpdateCustomer = CustomerFormSchema.omit({ id: true });

// Removes an uploaded avatar from the bucket. Never touches the default
// avatar or the course images, which live in public/, not in the bucket.
async function deleteAvatar(imageURL: string | null) {
  if (!imageURL || !imageURL.startsWith("/api/avatars/")) return;
  const key = imageURL.replace("/api/avatars/", "");
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (error) {
    console.log(error); // an orphaned file is harmless, so don't fail the action
  }
}

export async function updateCustomer(
  id: string,
  prevState: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const validatedFields = UpdateCustomer.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing or invalid fields. Failed to update customer.",
    };
  }

  const { name, email } = validatedFields.data;

  // Remember the current avatar so we can replace it later.
  let oldImageUrl: string | null = null;
  try {
    const rows = await sql<{ image_url: string | null }[]>`
      SELECT image_url FROM customers
      WHERE id = ${id} AND deleted_at IS NULL
    `;
    if (rows.length === 0) return { message: "Customer not found." };
    oldImageUrl = rows[0].image_url;
  } catch (error) {
    console.log(error);
    return { message: "Database error: failed to update customer." };
  }

  let imageUrl = oldImageUrl;
  let replaced = false;
  const file = formData.get("image");

  if (file instanceof File && file.size > 0) {
    const extension = ALLOWED_TYPES[file.type];
    if (!extension) {
      return {
        errors: { image: ["Please upload a PNG, JPEG or WebP image."] },
        message: "Failed to update customer.",
      };
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return {
        errors: { image: ["The image must be smaller than 1 MB."] },
        message: "Failed to update customer.",
      };
    }
    const key = `${randomUUID()}.${extension}`;
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: Buffer.from(await file.arrayBuffer()),
          ContentType: file.type,
        }),
      );
    } catch (error) {
      console.log(error);
      return { message: "Upload failed. Please try again." };
    }
    imageUrl = `/api/avatars/${key}`;
    replaced = true;
  }

  try {
    await sql`
      UPDATE customers
      SET name = ${name}, email = ${email}, image_url = ${imageUrl}
      WHERE id = ${id} AND deleted_at IS NULL
    `;
  } catch (error) {
    console.log(error);
    if (replaced) await deleteAvatar(imageUrl); // undo the new upload
    return { message: "Database error: failed to update customer." };
  }

  if (replaced) await deleteAvatar(oldImageUrl); // only after the update succeeded

  revalidatePath("/dashboard/customers");
  redirect("/dashboard/customers");
}

export async function deleteCustomer(id: string) {
  const [row] = await sql<{ balance: string }[]>`
    SELECT COALESCE(SUM(amount), 0) AS balance
    FROM invoices
    WHERE customer_id = ${id} AND status = 'pending'
  `;

  if (Number(row.balance) > 0) {
    throw new Error('This customer still has an outstanding balance.');
  }

  await sql`
    UPDATE customers SET deleted_at = NOW()
    WHERE id = ${id} AND deleted_at IS NULL
  `;

  revalidatePath('/dashboard/customers');
  revalidatePath('/dashboard');
}