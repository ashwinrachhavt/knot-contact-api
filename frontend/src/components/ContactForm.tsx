import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Contacts } from "../api/contacts";

const emptyContact = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
};

type DraftContact = typeof emptyContact;

export default function ContactForm(): JSX.Element {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DraftContact>(emptyContact);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => Contacts.create(draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setDraft(emptyContact);
      setError(null);
    },
    onError: (err: any) => {
      const message = err?.response?.data?.email?.[0] ?? "Unable to create contact.";
      setError(message);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <form className="space-y-3 p-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-3">
        <input
          className="col-span-1 rounded-lg border p-2"
          placeholder="First name"
          value={draft.first_name}
          onChange={(event) => setDraft({ ...draft, first_name: event.target.value })}
          required
        />
        <input
          className="col-span-1 rounded-lg border p-2"
          placeholder="Last name"
          value={draft.last_name}
          onChange={(event) => setDraft({ ...draft, last_name: event.target.value })}
          required
        />
        <input
          className="col-span-2 rounded-lg border p-2"
          placeholder="Email"
          type="email"
          value={draft.email}
          onChange={(event) => setDraft({ ...draft, email: event.target.value })}
          required
        />
        <input
          className="col-span-2 rounded-lg border p-2"
          placeholder="Phone"
          value={draft.phone}
          onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
          required
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        className="rounded-xl bg-brand-700 px-4 py-2 text-white"
        disabled={create.isPending}
      >
        {create.isPending ? "Creating… (20s delay)" : "Create (20s delay)"}
      </button>
    </form>
  );
}
