# Contacts App — Tech Spec, Code & Agents

> Stack: **React + Vite (TypeScript) + TailwindCSS** (frontend) · **Django 5 + Django REST Framework + Channels + SQLite** (backend) · **WebSockets via Channels + Redis** for real-time · **Docker Compose** for local dev · **pytest + pytest-django** for tests.

---

## 1) System Overview

The Contacts App is a full‑stack CRUD application with edit‑history and **real‑time** updates across clients. It also intentionally injects a **20‑second delay** on `POST /api/contacts/` to simulate slow networks/servers.

### Core Requirements

* Create/Read/Update/Delete Contacts
* Mandatory fields: first_name, last_name, email (unique), phone
* **No duplicate emails** (DB + serializer validation)
* **Edit history** per contact (immutable versions)
* **Real-time updates** when contacts change, including changes from outside the UI
* SQLite persistence
* Clean API with DRF viewsets + routers
* The **create** endpoint sleeps 20 seconds
* Containerized with Docker; `docker-compose up` runs everything
* Makefile for DX (migrate, seed, superuser, test, run)
* Pytest test suite

### High-Level Architecture

* **Frontend** (Vite React TS): Fetches REST data using React Query. Opens a WebSocket to receive change events (create/update/delete). Maintains consistent UI state via invalidating React Query caches on events.
* **Backend** (Django + DRF + Channels):

  * DRF ViewSets for Contacts & History read.
  * On create/update/delete, persist Contact + add a **ContactVersion** row.
  * Broadcast change events to Channels group `contacts`.
  * Simulate 20s delay on create.
* **Realtime**: Channels + Redis channel layer. Daphne ASGI server handles HTTP + WS. Group broadcast on mutations.
* **DB**: SQLite with WAL enabled. Unique index on `email`.

---

## 2) API Design (DRF)

**Base URL:** `/api/`

### Endpoints

* `GET /api/contacts/` — list (query params: `search`, `page`, `page_size`)
* `POST /api/contacts/` — create **(20s delay)**
* `GET /api/contacts/{id}/` — retrieve
* `PUT /api/contacts/{id}/` — update (full)
* `PATCH /api/contacts/{id}/` — update (partial)
* `DELETE /api/contacts/{id}/` — delete
* `GET /api/contacts/{id}/history/` — list versions chronologically (latest first)
* `POST /api/external-update/` — simulate external changes (updates a contact and emits WS event)

### Realtime Channel

* **WS URL:** `ws://<backend-host>/ws/contacts/`
* **Group:** `contacts`
* **Event payloads:**

  ```json
  { "type": "contact.created", "contact": {"id":1, ...} }
  { "type": "contact.updated", "contact": {"id":1, ...} }
  { "type": "contact.deleted", "contact_id": 1 }
  ```

---

## 3) Data Model

```python
# backend/core/models.py
from django.db import models
from django.utils import timezone

class Contact(models.Model):
    first_name = models.CharField(max_length=100)
    last_name  = models.CharField(max_length=100)
    email      = models.EmailField(unique=True)
    phone      = models.CharField(max_length=30)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} <{self.email}>"

class ContactVersion(models.Model):
    contact    = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name="versions")
    first_name = models.CharField(max_length=100)
    last_name  = models.CharField(max_length=100)
    email      = models.EmailField()
    phone      = models.CharField(max_length=30)
    edited_at  = models.DateTimeField(default=timezone.now)
    edited_reason = models.CharField(max_length=200, blank=True)  # optional
    # could add editor fields (user) later

    class Meta:
        indexes = [models.Index(fields=["contact", "edited_at"])]
        ordering = ["-edited_at", "-id"]
```

**Versioning logic**: On **create** and every **update**, append a `ContactVersion` snapshot, capturing the full state.

---

## 4) Serializers

```python
# backend/core/serializers.py
from rest_framework import serializers
from .models import Contact, ContactVersion

class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ["id", "first_name", "last_name", "email", "phone", "created_at", "updated_at"]

    def validate(self, attrs):
        # email uniqueness is enforced at DB level; DRF-friendly error here too
        email = attrs.get("email")
        instance = getattr(self, 'instance', None)
        qs = Contact.objects.filter(email=email)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if email and qs.exists():
            raise serializers.ValidationError({"email": "Email must be unique."})
        return attrs

class ContactVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactVersion
        fields = ["id", "contact", "first_name", "last_name", "email", "phone", "edited_at", "edited_reason"]
```

---

## 5) Views / ViewSets & Routing

```python
# backend/core/views.py
import time
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.db import transaction
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Contact, ContactVersion
from .serializers import ContactSerializer, ContactVersionSerializer

class ContactViewSet(viewsets.ModelViewSet):
    queryset = Contact.objects.all().order_by("-updated_at")
    serializer_class = ContactSerializer

    def perform_create(self, serializer):
        # simulate 20s delay
        time.sleep(20)
        with transaction.atomic():
            contact = serializer.save()
            ContactVersion.objects.create(
                contact=contact,
                first_name=contact.first_name,
                last_name=contact.last_name,
                email=contact.email,
                phone=contact.phone,
                edited_reason="created",
            )
        self._broadcast("contact.created", ContactSerializer(contact).data)

    def perform_update(self, serializer):
        with transaction.atomic():
            contact = serializer.save()
            ContactVersion.objects.create(
                contact=contact,
                first_name=contact.first_name,
                last_name=contact.last_name,
                email=contact.email,
                phone=contact.phone,
                edited_reason="updated",
            )
        self._broadcast("contact.updated", ContactSerializer(contact).data)

    def perform_destroy(self, instance):
        contact_id = instance.id
        instance.delete()
        self._broadcast("contact.deleted", {"id": contact_id})

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        versions = ContactVersion.objects.filter(contact_id=pk).order_by("-edited_at")
        return Response(ContactVersionSerializer(versions, many=True).data)

    def _broadcast(self, event_type, payload):
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "contacts",
            {"type": "contacts.event", "event": {"type": event_type, "payload": payload}},
        )

@api_view(["POST"])
@transaction.atomic
def external_update(request):
    """Simulate out-of-band updates (e.g., another service)."""
    cid = request.data.get("id")
    fields = {k: v for k, v in request.data.items() if k in {"first_name", "last_name", "email", "phone"}}
    contact = Contact.objects.select_for_update().get(id=cid)
    for k, v in fields.items():
        setattr(contact, k, v)
    contact.save()
    ContactVersion.objects.create(
        contact=contact,
        first_name=contact.first_name,
        last_name=contact.last_name,
        email=contact.email,
        phone=contact.phone,
        edited_reason="external_update",
    )
    # broadcast
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "contacts",
        {"type": "contacts.event", "event": {"type": "contact.updated", "payload": ContactSerializer(contact).data}},
    )
    return Response(ContactSerializer(contact).data)
```

```python
# backend/backend/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import ContactViewSet, external_update

router = DefaultRouter()
router.register(r"contacts", ContactViewSet, basename="contact")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/external-update/", external_update),
]
```

---

## 6) Realtime (Channels)

```python
# backend/backend/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import path
from core import consumers

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter([path("ws/contacts/", consumers.ContactsConsumer.as_asgi())])
    ),
})
```

```python
# backend/core/consumers.py
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class ContactsConsumer(AsyncJsonWebsocketConsumer):
    group_name = "contacts"

    async def connect(self):
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def contacts_event(self, event):
        await self.send_json(event["event"])  # forward to clients
```

```python
# backend/backend/settings.py (relevant parts)
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "channels",
    "core",
]

ASGI_APPLICATION = "backend.asgi.application"

# Channels (Redis layer)
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [("redis", 6379)]},
    }
}

# SQLite + WAL (optional at startup via PRAGMA)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}
```

---

## 7) Frontend (React + Vite + TS + Tailwind)

**App Structure**

```
frontend/
  src/
    api/client.ts          # axios + baseURL
    api/contacts.ts        # REST + WS helpers
    components/
      ContactList.tsx
      ContactForm.tsx
      ContactHistory.tsx
      Toast.tsx
    hooks/useContactsWS.ts # WebSocket hook
    theme.css              # CSS variables & Tailwind tokens
    main.tsx
    App.tsx
  index.html
  tailwind.config.ts
```

**Theme (CSS Variables)**

```css
/* frontend/src/theme.css */
@import "tailwindcss";
@theme {
  --color-brand-600: oklch(0.65 0.12 250);
  --color-brand-700: oklch(0.58 0.12 250);
  --radius-card: 1rem;
}
:root {
  --ring: var(--color-brand-600);
}
```

**React Query + Axios client**

```ts
// frontend/src/api/client.ts
import axios from "axios";
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api" });
```

**Contacts API + WS helper**

```ts
// frontend/src/api/contacts.ts
import { api } from "./client";

export type Contact = { id: number; first_name: string; last_name: string; email: string; phone: string; created_at: string; updated_at: string };
export type ContactEvent = { type: "contact.created"|"contact.updated"|"contact.deleted"; payload: any };

export const Contacts = {
  list: (params?: any) => api.get<Contact[]>("/contacts/", { params }).then(r => r.data),
  create: (body: Partial<Contact>) => api.post<Contact>("/contacts/", body).then(r => r.data),
  update: (id: number, body: Partial<Contact>) => api.patch<Contact>(`/contacts/${id}/`, body).then(r => r.data),
  remove: (id: number) => api.delete(`/contacts/${id}/`).then(r => r.data),
  history: (id: number) => api.get(`/contacts/${id}/history/`).then(r => r.data),
};

export const openContactsSocket = (): WebSocket => new WebSocket((import.meta.env.VITE_WS_URL || "ws://localhost:8000") + "/ws/contacts/");
```

**WebSocket Hook**

```ts
// frontend/src/hooks/useContactsWS.ts
import { useEffect } from "react";
import { QueryClient } from "@tanstack/react-query";
import { openContactsSocket, ContactEvent } from "../api/contacts";

export function useContactsWS(qc: QueryClient) {
  useEffect(() => {
    const ws = openContactsSocket();
    ws.onmessage = (e) => {
      const evt = JSON.parse(e.data) as ContactEvent;
      if (evt.type === "contact.created" || evt.type === "contact.updated" || evt.type === "contact.deleted") {
        // refresh queries
        qc.invalidateQueries({ queryKey: ["contacts"] });
      }
    };
    return () => ws.close();
  }, [qc]);
}
```

**Components (samples)**

```tsx
// frontend/src/components/ContactList.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Contacts } from "../api/contacts";

export default function ContactList({ onSelect }: { onSelect: (id:number)=>void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["contacts"], queryFn: () => Contacts.list() });
  const del = useMutation({ mutationFn: (id:number)=>Contacts.remove(id), onSuccess: ()=>qc.invalidateQueries({queryKey:["contacts"]}) });
  if (isLoading) return <div className="p-4">Loading…</div>;
  return (
    <div className="space-y-2 p-4">
      {data?.map(c => (
        <div key={c.id} className="rounded-xl border p-3 hover:bg-gray-50 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="font-semibold">{c.first_name} {c.last_name}</div>
            <div className="text-sm text-gray-600">{c.email} · {c.phone}</div>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded-lg bg-brand-600 text-white" onClick={()=>onSelect(c.id)}>History</button>
            <button className="px-3 py-1 rounded-lg border" onClick={()=>del.mutate(c.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

```tsx
// frontend/src/components/ContactForm.tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Contacts } from "../api/contacts";
import { useState } from "react";

export default function ContactForm() {
  const qc = useQueryClient();
  const [f,setF] = useState({first_name:"", last_name:"", email:"", phone:""});
  const create = useMutation({ mutationFn: ()=>Contacts.create(f), onSuccess: ()=>{ qc.invalidateQueries({queryKey:["contacts"]}); setF({first_name:"",last_name:"",email:"",phone:""}); }});

  return (
    <form className="p-4 space-y-3" onSubmit={(e)=>{e.preventDefault(); create.mutate();}}>
      <div className="grid grid-cols-2 gap-3">
        <input className="border rounded-lg p-2" placeholder="First name" value={f.first_name} onChange={e=>setF({...f, first_name:e.target.value})}/>
        <input className="border rounded-lg p-2" placeholder="Last name" value={f.last_name} onChange={e=>setF({...f, last_name:e.target.value})}/>
        <input className="border rounded-lg p-2 col-span-2" placeholder="Email" value={f.email} onChange={e=>setF({...f, email:e.target.value})}/>
        <input className="border rounded-lg p-2 col-span-2" placeholder="Phone" value={f.phone} onChange={e=>setF({...f, phone:e.target.value})}/>
      </div>
      <button className="px-4 py-2 rounded-xl bg-brand-700 text-white">Create (20s delay)</button>
    </form>
  );
}
```

**App Entrypoint**

```tsx
// frontend/src/App.tsx
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import ContactForm from "./components/ContactForm";
import ContactList from "./components/ContactList";
import { useContactsWS } from "./hooks/useContactsWS";
import { useState } from "react";

const qc = new QueryClient();

function InnerApp(){
  const queryClient = useQueryClient();
  useContactsWS(queryClient);
  const [selectedId, setSelectedId] = useState<number|undefined>();
  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Contacts</h1>
      <ContactForm />
      <ContactList onSelect={(id)=>setSelectedId(id)} />
    </div>
  );
}

export default function App(){
  return (
    <QueryClientProvider client={qc}>
      <InnerApp/>
    </QueryClientProvider>
  );
}
```

**Tailwind config (V4+ default plugin)**

```ts
// frontend/tailwind.config.ts
import type { Config } from 'tailwindcss'
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
} satisfies Config
```

---

## 8) Tests (pytest)

```ini
# backend/pytest.ini
[pytest]
DJANGO_SETTINGS_MODULE = backend.settings
python_files = tests.py test_*.py *_tests.py
addopts = -q
```

```python
# backend/core/tests/test_contacts_api.py
import json, time
from django.urls import reverse
from rest_framework.test import APIClient
from core.models import Contact, ContactVersion

client = APIClient()

def test_create_contact_creates_version(db, monkeypatch):
    # speed up test: stub sleep
    monkeypatch.setattr(time, "sleep", lambda s: None)
    resp = client.post("/api/contacts/", {
        "first_name": "Ada", "last_name": "Lovelace",
        "email": "ada@example.com", "phone": "+1-555-1000"
    }, format='json')
    assert resp.status_code == 201
    c = Contact.objects.get(email="ada@example.com")
    assert ContactVersion.objects.filter(contact=c).count() == 1

def test_email_unique_validation(db):
    Contact.objects.create(first_name="A", last_name="B", email="x@y.com", phone="1")
    resp = client.post("/api/contacts/", {"first_name":"C","last_name":"D","email":"x@y.com","phone":"2"}, format='json')
    assert resp.status_code == 400
    assert "email" in resp.data
```

---

## 9) Docker & DevOps

**Dockerfile (backend)**

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend /app
# Ensure sqlite db directory
RUN mkdir -p /app && chmod -R 777 /app
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "backend.asgi:application"]
```

**requirements.txt**

```
Django==5.0.7
djangorestframework==3.15.2
channels==4.1.0
channels-redis==4.2.0
asgiref==3.8.1
pytest==8.2.0
pytest-django==4.9.0
```

**Dockerfile (frontend)**

```dockerfile
# frontend/Dockerfile
FROM node:22-alpine as build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**docker-compose.yml**

```yaml
version: "3.9"
services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - ./db:/app
    depends_on:
      - redis
    environment:
      - DJANGO_SETTINGS_MODULE=backend.settings
  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "5173:80"
    environment:
      - VITE_API_URL=http://localhost:8000/api
      - VITE_WS_URL=ws://localhost:8000
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
volumes:
  db:
```

**Makefile**

```makefile
# Makefile at repo root
.PHONY: up down logs shell migrate superuser test seed fmt

up:
	docker compose up --build -d
	docker compose exec backend python manage.py migrate

Down:
	docker compose down

logs:
	docker compose logs -f --tail=200 backend

shell:
	docker compose exec backend python manage.py shell_plus || docker compose exec backend python manage.py shell

migrate:
	docker compose exec backend python manage.py makemigrations
	docker compose exec backend python manage.py migrate

superuser:
	docker compose exec backend python manage.py createsuperuser --email admin@example.com --username admin

seed:
	docker compose exec backend python manage.py shell -c "from core.models import Contact; [Contact.objects.get_or_create(first_name='John',last_name='Doe',email=f'john{i}@ex.com',phone='555-000') for i in range(3)]"

test:
	docker compose exec backend pytest
```

---

## 10) Settings & SQLite WAL

**Enable WAL at startup** (optional)

```python
# backend/core/apps.py
from django.apps import AppConfig
from django.db import connection

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        try:
            with connection.cursor() as c:
                c.execute("PRAGMA journal_mode=WAL;")
        except Exception:
            pass
```

```python
# backend/core/__init__.py
default_app_config = "core.apps.CoreConfig"
```

---

## 11) Admin (Optional)

```python
# backend/core/admin.py
from django.contrib import admin
from .models import Contact, ContactVersion

@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ("first_name","last_name","email","phone","updated_at")
    search_fields = ("first_name","last_name","email","phone")

@admin.register(ContactVersion)
class ContactVersionAdmin(admin.ModelAdmin):
    list_display = ("contact","edited_at","edited_reason")
    search_fields = ("contact__email",)
```

---

## 12) Agents.md (Tech Spec for AI Agents in this Repo)

```markdown
# Agents.md — Developer Copilot Agents for Contacts App

This repo includes a lightweight **agentic workflow** to speed up development and QA. These are prompt conventions and guardrails for ChatGPT/Copilot/CrewAI/etc.

## Goals
- Keep code **modular, typed and testable**
- Enforce **API contracts** (DRF) and **UI state** (React Query)
- Preserve **realtime invariants** (Channels events fire on every mutation)

## Agents

### 1) API Architect Agent
**Input**: Endpoint diff or new requirement.  
**Output**: DRF serializer + viewset updates, router wiring, tests.  
**Checklist**:
- Unique constraints validated in serializer and DB
- `perform_create/update/destroy` broadcast Channels events
- For create: keep `time.sleep(20)`
- Add history snapshots in the same transaction

**Guardrails**: No breaking response shapes; add tests covering 201/400/409 paths.

### 2) Realtime Guardian Agent
**Input**: Any change touching Contact mutations.  
**Output**: Consumer and event schema review.  
**Checklist**:
- Event types: `contact.created|updated|deleted`
- Payload minimal yet sufficient for cache invalidation
- Group name `contacts` consistent; no hard-coded hosts

### 3) UI Polisher Agent
**Input**: React component or layout PR.  
**Output**: Enforce Tailwind tokens, a11y roles/labels, loading/empty/error states.  
**Checklist**:
- Use `theme.css` tokens; consistent radii and primary hues
- React Query: optimistic updates only if server guarantees success; otherwise keep invalidate+refetch
- WebSocket hook must cleanup on unmount

### 4) Test Weaver Agent
**Input**: Feature or bug report.  
**Output**: `pytest` tests including API and model behavior.  
**Checklist**:
- Patch `time.sleep` in create tests to avoid 20s
- Assert a `ContactVersion` row per mutation
- Validate email uniqueness and history ordering

## Prompts
- **API change**: "Update DRF to add `/api/contacts/{id}/archive/` action. Include serializer fields, viewset action, and tests. Keep Channels broadcasts aligned."
- **UI fix**: "Refactor `ContactList` to support search input with debounced query param and empty state. Maintain theme tokens and a11y."

## CI Hooks (optional)
- Run `pytest`
- Lint TS/py
- Typecheck TS
```

---

## 13) Developer Experience Notes

* Local dev: `make up` then hit `http://localhost:5173` (frontend) and `http://localhost:8000/api/contacts/`.
* Configure `.env` (optional) for VITE URLs.
* To simulate external updates: `POST /api/external-update/ {"id": <id>, ...}`; all connected UIs update instantly.
* For production, place Nginx in front (optional); Daphne serves HTTP+WS.

---

## 14) Future Enhancements

* Auth & per‑user scoping; editor identity in history
* Pagination + server‑side search filters (email/phone)
* E2E tests with Playwright
* Swap SQLite to Postgres; keep Channels/DRF unchanged
* Add retries/backoff in WS hook & show a toast on re-connect
