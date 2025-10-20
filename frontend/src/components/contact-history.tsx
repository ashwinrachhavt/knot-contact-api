"use client";

import { useQuery } from "@tanstack/react-query";
import { ContactsApi, type Contact, type ContactHistoryEntry } from "@/lib/api/contacts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ContactHistoryProps {
  contact?: Contact;
}

export function ContactHistory({ contact }: ContactHistoryProps) {
  const historyQuery = useQuery({
    queryKey: ["contact-history", contact?.id],
    queryFn: () => ContactsApi.history(contact!.id),
    enabled: Boolean(contact?.id),
  });

  if (!contact) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Select a contact to view their edit history.
        </CardContent>
      </Card>
    );
  }

  if (historyQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading history…</CardContent>
      </Card>
    );
  }

  if (historyQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-destructive">Unable to load history.</CardContent>
      </Card>
    );
  }

  const events = historyQuery.data as ContactHistoryEntry[];

  if (!events || events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No history available for this contact yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          History for {contact.first_name} {contact.last_name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4 text-sm">
          {events.map((version) => (
            <li key={version.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">
                  {version.edited_reason?.replaceAll("_", " ") ?? "updated"}
                </span>
                <time className="text-muted-foreground">
                  {new Date(version.edited_at).toLocaleString()}
                </time>
              </div>
              <dl className="mt-2 grid gap-1 text-muted-foreground md:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase">Name</dt>
                  <dd>
                    {version.first_name} {version.last_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase">Email</dt>
                  <dd>{version.email}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-xs uppercase">Phone</dt>
                  <dd>{version.phone}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
