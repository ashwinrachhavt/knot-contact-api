"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Contact, ContactsApi } from "@/lib/api/contacts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const [editDraft, setEditDraft] = useState<Contact | null>(null);

  const deleteContact = useMutation({
    mutationFn: async (id: number) => ContactsApi.remove(id),
    onSuccess: () => {
      toast.success("Contact deleted");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-history"] });
    },
    onError: () => {
      toast.error("Unable to delete contact");
    },
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Contact> }) =>
      ContactsApi.update(id, data),
    onSuccess: () => {
      toast.success("Contact updated");
      setEditDraft(null);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-history"] });
    },
    onError: () => {
      toast.error("Unable to update contact");
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
        const isEditing = editDraft?.id === contact.id;

        if (isEditing) {
          const draft = editDraft;

          if (!draft) {
            return null;
          }

          return (
            <Card
              key={contact.id}
              className="border-ring shadow-lg"
              aria-label={`Editing ${contact.first_name} ${contact.last_name}`}
            >
              <CardHeader>
                <CardTitle className="text-lg">Edit contact</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    updateContact.mutate({
                      id: contact.id,
                      data: {
                        first_name: draft.first_name,
                        last_name: draft.last_name,
                        email: draft.email,
                        phone: draft.phone,
                      },
                    });
                  }}
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`edit-first-${contact.id}`}>First name</Label>
                      <Input
                        id={`edit-first-${contact.id}`}
                        value={draft.first_name}
                        onChange={(event) =>
                          setEditDraft((draft) =>
                            draft && draft.id === contact.id
                              ? { ...draft, first_name: event.target.value }
                              : draft,
                          )
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`edit-last-${contact.id}`}>Last name</Label>
                      <Input
                        id={`edit-last-${contact.id}`}
                        value={draft.last_name}
                        onChange={(event) =>
                          setEditDraft((draft) =>
                            draft && draft.id === contact.id
                              ? { ...draft, last_name: event.target.value }
                              : draft,
                          )
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`edit-email-${contact.id}`}>Email</Label>
                      <Input
                        id={`edit-email-${contact.id}`}
                        type="email"
                        value={draft.email}
                        onChange={(event) =>
                          setEditDraft((draft) =>
                            draft && draft.id === contact.id
                              ? { ...draft, email: event.target.value }
                              : draft,
                          )
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`edit-phone-${contact.id}`}>Phone</Label>
                      <Input
                        id={`edit-phone-${contact.id}`}
                        value={draft.phone}
                        onChange={(event) =>
                          setEditDraft((draft) =>
                            draft && draft.id === contact.id
                              ? { ...draft, phone: event.target.value }
                              : draft,
                          )
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={updateContact.isPending}>
                      {updateContact.isPending ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setEditDraft(null)}
                      disabled={updateContact.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          );
        }

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
                onClick={() =>
                  setEditDraft({
                    id: contact.id,
                    first_name: contact.first_name,
                    last_name: contact.last_name,
                    email: contact.email,
                    phone: contact.phone,
                    created_at: contact.created_at,
                    updated_at: contact.updated_at,
                  })
                }
              >
                Edit
              </Button>
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
