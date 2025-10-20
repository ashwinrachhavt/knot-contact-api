import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import ContactForm from "./components/ContactForm";
import ContactList from "./components/ContactList";
import { useContactsWS } from "./hooks/useContactsWS";

const queryClient = new QueryClient();

function ContactsApp(): JSX.Element {
  const qc = useQueryClient();
  useContactsWS(qc);
  const [selectedId, setSelectedId] = useState<number | undefined>();

  return (
    <div className="mx-auto max-w-3xl py-8">
      <h1 className="mb-4 text-2xl font-bold">Contacts</h1>
      <ContactForm />
      <ContactList onSelect={(id) => setSelectedId(id)} selectedId={selectedId} />
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <ContactsApp />
    </QueryClientProvider>
  );
}
