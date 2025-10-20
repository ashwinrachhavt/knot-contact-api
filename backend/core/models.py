from django.db import models
from django.utils import timezone


class Contact(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name} <{self.email}>"


class ContactVersion(models.Model):
    contact = models.ForeignKey(
        Contact, on_delete=models.CASCADE, related_name="versions"
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=30)
    edited_at = models.DateTimeField(default=timezone.now)
    edited_reason = models.CharField(max_length=200, blank=True)

    class Meta:
        indexes = [models.Index(fields=["contact", "edited_at"])]
        ordering = ["-edited_at", "-id"]
