import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { deleteCustomer } from "@/app/lib/actions";

export function UpdateCustomer({ id }: { id: string }) {
  return (
    <Link
      href={`/dashboard/customers/${id}/edit`}
      className="rounded-md border p-2 hover:bg-gray-100"
    >
      <PencilIcon className="w-5" />
    </Link>
  );
}

export function DeleteCustomer({
  id,
  hasBalance,
}: {
  id: string;
  hasBalance: boolean;
}) {
  const deleteCustomerWithId = deleteCustomer.bind(null, id);

  return (
    <form action={deleteCustomerWithId}>
      <button
        type="submit"
        disabled={hasBalance}
        title={
          hasBalance
            ? "This customer still has an outstanding balance"
            : "Delete customer"
        }
        className="rounded-md border p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <span className="sr-only">Delete</span>
        <TrashIcon className="w-5" />
      </button>
    </form>
  );
}
