"use client";

import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { openContactsSocket, type ContactEvent } from "@/lib/api/contacts";

export function useContactsWS(queryClient: QueryClient, onDeleted?: (id: number) => void) {
  useEffect(() => {
    const ws = openContactsSocket();

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as ContactEvent;
        if (
          payload.type === "contact.created" ||
          payload.type === "contact.updated" ||
          payload.type === "contact.deleted"
        ) {
          queryClient.invalidateQueries({ queryKey: ["contacts"] });
          queryClient.invalidateQueries({ queryKey: ["contact-history"] });

          if (payload.type === "contact.deleted") {
            const data = payload.payload as Record<string, unknown>;
            const id = (data?.id ?? data?.contact_id) as number | undefined;
            if (typeof id === "number") {
              onDeleted?.(id);
            }
          }
        }
      } catch (error) {
        console.error("Failed to parse contacts websocket payload", error);
      }
    };

    return () => {
      ws.close();
    };
  }, [onDeleted, queryClient]);
}
