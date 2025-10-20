import time

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import Contact, ContactVersion
from .serializers import ContactSerializer, ContactVersionSerializer


class ContactViewSet(viewsets.ModelViewSet):
    queryset = Contact.objects.all().order_by("-updated_at")
    serializer_class = ContactSerializer

    def perform_create(self, serializer):
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
        serializer = ContactVersionSerializer(versions, many=True)
        return Response(serializer.data)

    def _broadcast(self, event_type: str, payload: dict):
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "contacts",
            {
                "type": "contacts.event",
                "event": {"type": event_type, "payload": payload},
            },
        )


@api_view(["POST"])
@transaction.atomic
def external_update(request):
    contact_id = request.data.get("id")
    contact = get_object_or_404(Contact.objects.select_for_update(), id=contact_id)
    fields = {
        key: value
        for key, value in request.data.items()
        if key in {"first_name", "last_name", "email", "phone"}
    }
    for key, value in fields.items():
        setattr(contact, key, value)
    contact.save()
    ContactVersion.objects.create(
        contact=contact,
        first_name=contact.first_name,
        last_name=contact.last_name,
        email=contact.email,
        phone=contact.phone,
        edited_reason="external_update",
    )
    data = ContactSerializer(contact).data
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "contacts",
        {
            "type": "contacts.event",
            "event": {"type": "contact.updated", "payload": data},
        },
    )
    return Response(data, status=status.HTTP_200_OK)
