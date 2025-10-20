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

export type ContactEvent = {
  type: "contact.created" | "contact.updated" | "contact.deleted";
  payload: unknown;
};

export const Contacts = {
  list: (params?: Record<string, unknown>) =>
    api.get<Contact[]>("/contacts/", { params }).then((response) => response.data),
  create: (body: Partial<Contact>) =>
    api.post<Contact>("/contacts/", body).then((response) => response.data),
  update: (id: number, body: Partial<Contact>) =>
    api.patch<Contact>(`/contacts/${id}/`, body).then((response) => response.data),
  remove: (id: number) => api.delete(`/contacts/${id}/`).then((response) => response.data),
  history: (id: number) => api.get(`/contacts/${id}/history/`).then((response) => response.data),
};

export const openContactsSocket = (): WebSocket => {
  const base = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";
  return new WebSocket(`${base}/ws/contacts/`);
};
