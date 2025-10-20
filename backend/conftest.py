import pytest


@pytest.fixture(autouse=True)
def _inmemory_channels_layer(settings):
    settings.CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
    }
