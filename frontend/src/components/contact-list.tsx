"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Contact, ContactsApi } from "@/lib/api/contacts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface ContactListProps {
  onSelect?: (contact: Contact) => void;
  selectedId?: number;
}

export function ContactList({ onSelect, selectedId }: ContactListProps) {
  const queryClient = useQueryClient();
  const contactsQuery = useQuery({
    queryKey: ["contacts"],
    queryFn: () => ContactsApi.list(),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: number) => ContactsApi.remove(id),
    onSuccess: () => {
      toast.success("Contact deleted");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: () => {
      toast.error("Unable to delete contact");
    },
  });

  if (contactsQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading contacts…</CardContent>
      </Card>
    );
  }

  if (contactsQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-destructive">Unable to load contacts.</CardContent>
      </Card>
    );
  }

  const contacts = contactsQuery.data ?? [];

  if (contacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No contacts yet. Create one to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {contacts.map((contact) => {
        const isSelected = selectedId === contact.id;
        return (
          <Card
            key={contact.id}
            className={isSelected ? "border-ring shadow-lg" : undefined}
            aria-label={`${contact.first_name} ${contact.last_name}`}
          >
            <CardHeader>
              <CardTitle className="text-lg">
                {contact.first_name} {contact.last_name}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {contact.email} • {contact.phone}
              </p>
            </CardHeader>
            <CardContent className="flex justify-end gap-2">
              {onSelect && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onSelect(contact)}
                >
                  History
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => deleteContact.mutate(contact.id)}
                disabled={deleteContact.isPending}
              >
                Delete
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
