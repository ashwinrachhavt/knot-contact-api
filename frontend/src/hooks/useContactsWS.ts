import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { ContactEvent, openContactsSocket } from "../api/contacts";

export function useContactsWS(queryClient: QueryClient): void {
  useEffect(() => {
    const ws = openContactsSocket();
    ws.onmessage = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as ContactEvent;
      if (
        payload.type === "contact.created" ||
        payload.type === "contact.updated" ||
        payload.type === "contact.deleted"
      ) {
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
      }
    };

    return () => {
      ws.close();
    };
  }, [queryClient]);
}
