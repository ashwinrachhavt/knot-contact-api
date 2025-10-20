"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { ContactsApi } from "@/lib/api/contacts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
};

type DraftContact = typeof emptyForm;

type CreateErrorPayload = {
  email?: string[];
};

export function ContactForm() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DraftContact>(emptyForm);

  const createContact = useMutation({
    mutationFn: async () => ContactsApi.create(draft),
    onSuccess: () => {
      toast.success("Contact created. The list will refresh once the server responds.");
      setDraft(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: unknown) => {
      const message = extractEmailError(error) ?? (error instanceof Error ? error.message : undefined);
      toast.error(message ?? "Unable to create contact.");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Contact</CardTitle>
        <CardDescription>Creates a new contact. Server intentionally delays creation by 20 seconds.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            createContact.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="first-name">First name</Label>
            <Input
              id="first-name"
              placeholder="First name"
              value={draft.first_name}
              onChange={(event) => setDraft({ ...draft, first_name: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-name">Last name</Label>
            <Input
              id="last-name"
              placeholder="Last name"
              value={draft.last_name}
              onChange={(event) => setDraft({ ...draft, last_name: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="ada@example.com"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              placeholder="+1 555 0100"
              value={draft.phone}
              onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
              required
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={createContact.isPending} className="w-full md:w-auto">
              {createContact.isPending ? "Creating… (20s delay)" : "Create (20s delay)"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function extractEmailError(error: unknown) {
  if (isAxiosError<CreateErrorPayload>(error)) {
    return error.response?.data?.email?.[0];
  }
  return undefined;
}
