import { api } from "./client";

export type Contact = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  created_at: string;
  updated_at: string;
};

export type ContactEvent =
  | { type: "contact.created"; payload: Contact }
  | { type: "contact.updated"; payload: Contact }
  | { type: "contact.deleted"; payload: { id?: number; contact_id?: number } };

export type ContactHistoryEntry = {
  id: number;
  contact: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  edited_at: string;
  edited_reason?: string;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export const ContactsApi = {
  list: (params?: Record<string, unknown>) =>
    api
      .get<PaginatedResponse<Contact>>("/contacts/", { params })
      .then((response) => response.data.results),
  create: (body: Partial<Contact>) =>
    api.post<Contact>("/contacts/", body).then((response) => response.data),
  update: (id: number, body: Partial<Contact>) =>
    api.patch<Contact>(`/contacts/${id}/`, body).then((response) => response.data),
  remove: (id: number) => api.delete(`/contacts/${id}/`).then((response) => response.data),
  history: (id: number) =>
    api.get<ContactHistoryEntry[]>(`/contacts/${id}/history/`).then((response) => response.data),
};

export const openContactsSocket = () => {
  const base = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
  return new WebSocket(`${base}/ws/contacts/`);
};
