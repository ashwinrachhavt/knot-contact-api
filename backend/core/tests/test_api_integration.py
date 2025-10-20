"""Integration tests for the Contacts API."""

import time
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from core.models import Contact, ContactVersion


@pytest.fixture
def api_client():
    """Provide an API client for tests."""
    return APIClient()


@pytest.fixture
def sample_contact(db):
    """Create a sample contact for testing."""
    return Contact.objects.create(
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        phone="+1-555-1000"
    )


class TestContactCRUD:
    """Test CRUD operations for contacts."""

    @pytest.mark.unit
    def test_list_contacts(self, api_client, db):
        """Test listing all contacts."""
        Contact.objects.create(
            first_name="Alan",
            last_name="Turing",
            email="alan@example.com",
            phone="+1-555-2000"
        )
        Contact.objects.create(
            first_name="Grace",
            last_name="Hopper",
            email="grace@example.com",
            phone="+1-555-3000"
        )

        url = reverse("contact-list")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 2

    @pytest.mark.unit
    def test_create_contact(self, api_client, db, monkeypatch):
        """Test creating a new contact."""
        # Mock time.sleep to avoid waiting 20 seconds
        monkeypatch.setattr(time, "sleep", lambda _: None)

        url = reverse("contact-list")
        data = {
            "first_name": "Dennis",
            "last_name": "Ritchie",
            "email": "dennis@example.com",
            "phone": "+1-555-4000"
        }

        response = api_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["first_name"] == "Dennis"
        assert response.data["last_name"] == "Ritchie"
        assert response.data["email"] == "dennis@example.com"

        # Verify contact was created in database
        contact = Contact.objects.get(email="dennis@example.com")
        assert contact.first_name == "Dennis"

        # Verify version was created
        assert ContactVersion.objects.filter(contact=contact).count() == 1

    @pytest.mark.unit
    def test_retrieve_contact(self, api_client, sample_contact):
        """Test retrieving a specific contact."""
        url = reverse("contact-detail", kwargs={"pk": sample_contact.pk})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["first_name"] == "Ada"
        assert response.data["email"] == "ada@example.com"

    @pytest.mark.unit
    def test_update_contact(self, api_client, sample_contact):
        """Test updating a contact."""
        url = reverse("contact-detail", kwargs={"pk": sample_contact.pk})
        data = {
            "first_name": "Ada",
            "last_name": "Lovelace-Byron",
            "email": "ada@example.com",
            "phone": "+1-555-1001"
        }

        response = api_client.put(url, data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["last_name"] == "Lovelace-Byron"
        assert response.data["phone"] == "+1-555-1001"

        # Verify version was created
        assert ContactVersion.objects.filter(contact=sample_contact).count() == 1
        version = ContactVersion.objects.filter(contact=sample_contact).first()
        assert version.edited_reason == "updated"

    @pytest.mark.unit
    def test_partial_update_contact(self, api_client, sample_contact):
        """Test partially updating a contact."""
        url = reverse("contact-detail", kwargs={"pk": sample_contact.pk})
        data = {"phone": "+1-555-9999"}

        response = api_client.patch(url, data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["phone"] == "+1-555-9999"
        assert response.data["first_name"] == "Ada"  # Other fields unchanged

    @pytest.mark.unit
    def test_delete_contact(self, api_client, sample_contact):
        """Test deleting a contact."""
        contact_id = sample_contact.pk
        url = reverse("contact-detail", kwargs={"pk": contact_id})

        response = api_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Contact.objects.filter(pk=contact_id).exists()


class TestContactValidation:
    """Test validation rules for contacts."""

    @pytest.mark.unit
    def test_email_uniqueness(self, api_client, sample_contact, monkeypatch):
        """Test that duplicate emails are rejected."""
        monkeypatch.setattr(time, "sleep", lambda _: None)

        url = reverse("contact-list")
        data = {
            "first_name": "Another",
            "last_name": "Person",
            "email": "ada@example.com",  # Duplicate email
            "phone": "+1-555-5000"
        }

        response = api_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email" in response.data

    @pytest.mark.unit
    def test_required_fields(self, api_client, db):
        """Test that all required fields must be provided."""
        url = reverse("contact-list")
        data = {"first_name": "John"}  # Missing required fields

        response = api_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "last_name" in response.data
        assert "email" in response.data
        assert "phone" in response.data

    @pytest.mark.unit
    def test_invalid_email_format(self, api_client, db, monkeypatch):
        """Test that invalid email formats are rejected."""
        monkeypatch.setattr(time, "sleep", lambda _: None)

        url = reverse("contact-list")
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "not-an-email",  # Invalid email
            "phone": "+1-555-6000"
        }

        response = api_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email" in response.data


class TestContactHistory:
    """Test contact history tracking."""

    @pytest.mark.unit
    def test_contact_history(self, api_client, sample_contact):
        """Test retrieving contact edit history."""
        # Create some history
        ContactVersion.objects.create(
            contact=sample_contact,
            first_name="Ada",
            last_name="Lovelace",
            email="ada@example.com",
            phone="+1-555-1000",
            edited_reason="created"
        )

        # Update the contact
        url = reverse("contact-detail", kwargs={"pk": sample_contact.pk})
        data = {
            "first_name": "Ada",
            "last_name": "Byron",
            "email": "ada@example.com",
            "phone": "+1-555-1001"
        }
        api_client.put(url, data, format="json")

        # Get history
        history_url = reverse("contact-history", kwargs={"pk": sample_contact.pk})
        response = api_client.get(history_url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

        # Most recent should be first
        assert response.data[0]["edited_reason"] == "updated"
        assert response.data[1]["edited_reason"] == "created"


class TestExternalUpdate:
    """Test external update functionality."""

    @pytest.mark.unit
    def test_external_update(self, api_client, sample_contact):
        """Test updating a contact via external endpoint."""
        url = "/api/external-update/"
        data = {
            "id": sample_contact.pk,
            "first_name": "Ada",
            "last_name": "King",
            "email": "ada@example.com",
            "phone": "+1-555-1002"
        }

        response = api_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_200_OK

        # Verify contact was updated
        sample_contact.refresh_from_db()
        assert sample_contact.last_name == "King"
        assert sample_contact.phone == "+1-555-1002"

        # Verify version was created with correct reason
        version = ContactVersion.objects.filter(
            contact=sample_contact,
            edited_reason="external_update"
        ).first()
        assert version is not None

    @pytest.mark.unit
    def test_external_update_nonexistent_contact(self, api_client, db):
        """Test external update with non-existent contact ID."""
        url = "/api/external-update/"
        data = {
            "id": 99999,
            "first_name": "Ghost",
            "last_name": "Contact",
            "email": "ghost@example.com",
            "phone": "+1-555-0000"
        }

        response = api_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.slow
@pytest.mark.integration
class TestSlowContactCreation:
    """Test the intentional slow creation endpoint."""

    def test_contact_creation_delay(self, api_client, db):
        """Test that contact creation actually takes 20 seconds."""
        url = reverse("contact-list")
        data = {
            "first_name": "Slow",
            "last_name": "Contact",
            "email": "slow@example.com",
            "phone": "+1-555-7000"
        }

        start_time = time.time()
        response = api_client.post(url, data, format="json")
        elapsed_time = time.time() - start_time

        assert response.status_code == status.HTTP_201_CREATED
        assert elapsed_time >= 19.5  # Allow small variance
        assert elapsed_time <= 21.0  # Allow small overhead
