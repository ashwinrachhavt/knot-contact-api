from rest_framework import serializers

from .models import Contact, ContactVersion


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        email = attrs.get("email")
        instance = getattr(self, "instance", None)
        queryset = Contact.objects.filter(email=email)
        if instance is not None:
            queryset = queryset.exclude(pk=instance.pk)
        if email and queryset.exists():
            raise serializers.ValidationError({"email": "Email must be unique."})
        return attrs


class ContactVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactVersion
        fields = [
            "id",
            "contact",
            "first_name",
            "last_name",
            "email",
            "phone",
            "edited_at",
            "edited_reason",
        ]
