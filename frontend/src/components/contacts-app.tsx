"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Contact } from "@/lib/api/contacts";
import { useContactsWS } from "@/hooks/use-contacts-ws";
import { ContactForm } from "@/components/contact-form";
import { ContactList } from "@/components/contact-list";
import { ContactHistory } from "@/components/contact-history";

export function ContactsApp() {
  const queryClient = useQueryClient();
  const [selectedContact, setSelectedContact] = useState<Contact | undefined>();

  const handleDeleted = useCallback((id: number) => {
    setSelectedContact((current) => (current?.id === id ? undefined : current));
  }, []);

  useContactsWS(queryClient, handleDeleted);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Contacts</h1>
        <p className="text-muted-foreground">
          Manage contacts with real-time updates, edit history, and a simulated 20-second create delay.
        </p>
      </header>
      <ContactForm />
      <section className="grid gap-6 md:grid-cols-2">
        <ContactList
          onSelect={(contact) => setSelectedContact(contact)}
          selectedId={selectedContact?.id}
        />
        <ContactHistory contact={selectedContact} />
      </section>
    </div>
  );
}
