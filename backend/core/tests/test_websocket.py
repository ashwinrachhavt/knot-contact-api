"""Tests for WebSocket functionality."""

import pytest
from channels.testing import WebsocketCommunicator
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from backend.asgi import application
from core.models import Contact


@pytest.mark.asyncio
async def test_websocket_connect(db):
    """Test WebSocket connection."""
    communicator = WebsocketCommunicator(application, "/ws/contacts/")
    connected, _ = await communicator.connect()

    assert connected

    await communicator.disconnect()


@pytest.mark.asyncio
async def test_websocket_receives_contact_created_event(db):
    """Test that WebSocket receives contact created events."""
    communicator = WebsocketCommunicator(application, "/ws/contacts/")
    await communicator.connect()

    # Simulate broadcasting a contact created event
    channel_layer = get_channel_layer()
    await channel_layer.group_send(
        "contacts",
        {
            "type": "contacts.event",
            "event": {
                "type": "contact.created",
                "payload": {
                    "id": 1,
                    "first_name": "Test",
                    "last_name": "User",
                    "email": "test@example.com",
                    "phone": "+1-555-0000"
                }
            }
        }
    )

    # Receive the message
    response = await communicator.receive_json_from(timeout=5)

    assert response["type"] == "contact.created"
    assert response["payload"]["first_name"] == "Test"
    assert response["payload"]["email"] == "test@example.com"

    await communicator.disconnect()


@pytest.mark.asyncio
async def test_websocket_receives_contact_updated_event(db):
    """Test that WebSocket receives contact updated events."""
    communicator = WebsocketCommunicator(application, "/ws/contacts/")
    await communicator.connect()

    # Simulate broadcasting a contact updated event
    channel_layer = get_channel_layer()
    await channel_layer.group_send(
        "contacts",
        {
            "type": "contacts.event",
            "event": {
                "type": "contact.updated",
                "payload": {
                    "id": 1,
                    "first_name": "Updated",
                    "last_name": "User",
                    "email": "updated@example.com",
                    "phone": "+1-555-1111"
                }
            }
        }
    )

    # Receive the message
    response = await communicator.receive_json_from(timeout=5)

    assert response["type"] == "contact.updated"
    assert response["payload"]["first_name"] == "Updated"

    await communicator.disconnect()


@pytest.mark.asyncio
async def test_websocket_receives_contact_deleted_event(db):
    """Test that WebSocket receives contact deleted events."""
    communicator = WebsocketCommunicator(application, "/ws/contacts/")
    await communicator.connect()

    # Simulate broadcasting a contact deleted event
    channel_layer = get_channel_layer()
    await channel_layer.group_send(
        "contacts",
        {
            "type": "contacts.event",
            "event": {
                "type": "contact.deleted",
                "payload": {"id": 1}
            }
        }
    )

    # Receive the message
    response = await communicator.receive_json_from(timeout=5)

    assert response["type"] == "contact.deleted"
    assert response["payload"]["id"] == 1

    await communicator.disconnect()


@pytest.mark.asyncio
async def test_websocket_multiple_connections(db):
    """Test that multiple WebSocket connections receive broadcasts."""
    # Connect two clients
    comm1 = WebsocketCommunicator(application, "/ws/contacts/")
    comm2 = WebsocketCommunicator(application, "/ws/contacts/")

    await comm1.connect()
    await comm2.connect()

    # Broadcast an event
    channel_layer = get_channel_layer()
    await channel_layer.group_send(
        "contacts",
        {
            "type": "contacts.event",
            "event": {
                "type": "contact.created",
                "payload": {
                    "id": 2,
                    "first_name": "Broadcast",
                    "last_name": "Test",
                    "email": "broadcast@example.com",
                    "phone": "+1-555-2222"
                }
            }
        }
    )

    # Both clients should receive the message
    response1 = await comm1.receive_json_from(timeout=5)
    response2 = await comm2.receive_json_from(timeout=5)

    assert response1["type"] == "contact.created"
    assert response2["type"] == "contact.created"
    assert response1["payload"]["email"] == "broadcast@example.com"
    assert response2["payload"]["email"] == "broadcast@example.com"

    await comm1.disconnect()
    await comm2.disconnect()
