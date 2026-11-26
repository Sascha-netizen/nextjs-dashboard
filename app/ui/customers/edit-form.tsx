"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/app/ui/button";
import Image from "next/image";
import { updateCustomer, CustomerState } from "@/app/lib/actions";
import { CustomerForm } from "@/app/lib/definitions";

export default function EditCustomerForm({
  customer,
}: {
  customer: CustomerForm;
}) {
  const initialState: CustomerState = { message: null, errors: {} };
  const updateCustomerWithId = updateCustomer.bind(null, customer.id);
  const [state, formAction] = useActionState(
    updateCustomerWithId,
    initialState,
  );

  return (
    <form action={formAction}>
      <div className="rounded-md bg-gray-50 p-4 md:p-6">
        <div className="mb-4">
          <label htmlFor="name" className="mb-2 block text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="Enter customer name"
            className="block w-full rounded-md border border-gray-200 py-2 px-3 text-sm"
            aria-describedby="name-error"
            defaultValue={customer.name}
          />
          <div id="name-error" aria-live="polite" aria-atomic="true">
            {state.errors?.name?.map((e) => (
              <p className="mt-2 text-sm text-red-500" key={e}>
                {e}
              </p>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="email" className="mb-2 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="name@example.com"
            className="block w-full rounded-md border border-gray-200 py-2 px-3 text-sm"
            aria-describedby="email-error"
            defaultValue={customer.email}
          />
          <div id="email-error" aria-live="polite" aria-atomic="true">
            {state.errors?.email?.map((e) => (
              <p className="mt-2 text-sm text-red-500" key={e}>
                {e}
              </p>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="image" className="mb-2 block text-sm font-medium">
            Avatar (optional)
          </label>
          <Image
            src={customer.image_url}
            alt={`${customer.name}'s current avatar`}
            width={64}
            height={64}
            className="mb-3 h-16 w-16 rounded-full object-cover"
          />
          <input
            id="image"
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-sm"
            aria-describedby="image-error"
          />
          <div id="image-error" aria-live="polite" aria-atomic="true">
            {state.errors?.image?.map((e) => (
              <p className="mt-2 text-sm text-red-500" key={e}>
                {e}
              </p>
            ))}
          </div>
        </div>

        {state.message && (
          <p className="mt-2 text-sm text-red-500">{state.message}</p>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-4">
        <Link
          href="/dashboard/customers"
          className="flex h-10 items-center rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-600 hover:bg-gray-200"
        >
          Cancel
        </Link>
        <Button type="submit">Save Changes</Button>
      </div>
    </form>
  );
}
