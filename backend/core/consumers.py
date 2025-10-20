from channels.generic.websocket import AsyncJsonWebsocketConsumer


class ContactsConsumer(AsyncJsonWebsocketConsumer):
    group_name = "contacts"

    async def connect(self):
        if not self.channel_layer:
            await self.close()
            return

        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
        except Exception:  # pragma: no cover - redis unavailable
            await self.close()
            return

        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def contacts_event(self, event):
        await self.send_json(event["event"])
