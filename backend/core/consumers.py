from channels.generic.websocket import AsyncJsonWebsocketConsumer


class ContactsConsumer(AsyncJsonWebsocketConsumer):
    group_name = "contacts"

    async def connect(self):
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def contacts_event(self, event):
        await self.send_json(event["event"])
