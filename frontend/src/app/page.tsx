import { ContactsApp } from "@/components/contacts-app";
import { QueryClientWrapper } from "@/components/providers/query-client-provider";

export default function HomePage() {
  return (
    <QueryClientWrapper>
      <ContactsApp />
    </QueryClientWrapper>
  );
}
