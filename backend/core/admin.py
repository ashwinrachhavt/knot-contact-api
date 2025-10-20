from django.contrib import admin

from .models import Contact, ContactVersion


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "email", "phone", "updated_at")
    search_fields = ("first_name", "last_name", "email", "phone")


@admin.register(ContactVersion)
class ContactVersionAdmin(admin.ModelAdmin):
    list_display = ("contact", "edited_at", "edited_reason")
    search_fields = ("contact__email",)
