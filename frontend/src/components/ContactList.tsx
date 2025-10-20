import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Contacts, type Contact } from "../api/contacts";

interface Props {
  onSelect: (id: number) => void;
  selectedId?: number;
}

export default function ContactList({ onSelect, selectedId }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => Contacts.list(),
  });
  const remove = useMutation({
    mutationFn: (id: number) => Contacts.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500">Loading contacts…</div>;
  }

  if (isError) {
    return <div className="p-4 text-sm text-red-600">Unable to load contacts.</div>;
  }

  if (!data || data.length === 0) {
    return <div className="p-4 text-sm text-gray-500">No contacts yet.</div>;
  }

  return (
    <div className="space-y-2 p-4">
      {data.map((contact: Contact) => {
        const isSelected = contact.id === selectedId;
        return (
          <article
            key={contact.id}
            className={`flex items-center justify-between rounded-xl border p-3 transition hover:bg-gray-50 ${
              isSelected ? "ring-2 ring-brand-600" : ""
            }`}
            aria-label={`${contact.first_name} ${contact.last_name}`}
          >
            <div className="space-y-0.5">
              <p className="font-semibold">
                {contact.first_name} {contact.last_name}
              </p>
              <p className="text-sm text-gray-600">
                {contact.email} · {contact.phone}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-brand-600 px-3 py-1 text-white"
                onClick={() => onSelect(contact.id)}
              >
                History
              </button>
              <button
                type="button"
                className="rounded-lg border px-3 py-1"
                onClick={() => remove.mutate(contact.id)}
              >
                Delete
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
