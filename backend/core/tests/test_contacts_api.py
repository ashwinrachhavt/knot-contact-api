import time

from django.urls import reverse
from rest_framework.test import APIClient

from core.models import Contact, ContactVersion


client = APIClient()


def test_create_contact_creates_version(db, monkeypatch):
    monkeypatch.setattr(time, "sleep", lambda _: None)
    response = client.post(
        "/api/contacts/",
        {
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": "ada@example.com",
            "phone": "+1-555-1000",
        },
        format="json",
    )
    assert response.status_code == 201
    contact = Contact.objects.get(email="ada@example.com")
    assert ContactVersion.objects.filter(contact=contact).count() == 1


def test_email_unique_validation(db):
    Contact.objects.create(
        first_name="A", last_name="B", email="x@y.com", phone="1"
    )
    response = client.post(
        "/api/contacts/",
        {
            "first_name": "C",
            "last_name": "D",
            "email": "x@y.com",
            "phone": "2",
        },
        format="json",
    )
    assert response.status_code == 400
    assert "email" in response.data
