# backend/apps/notifications/models.py

from django.db import models
from apps.core.models import BaseModel

CHANNEL_CHOICES = [
    ("sms", "SMS"),
    ("email", "Email"),
]

STATUS_CHOICES = [
    ("pending", "Pending"),
    ("sent", "Sent"),
    ("failed", "Failed"),
]


class NotificationTemplate(BaseModel):
    """A reusable message template, e.g. "sale_receipt", "low_stock_alert".
    body_template uses Python str.format() placeholders, e.g.
    'Your order {order_id} total is {amount} BDT.'"""
    code = models.CharField(max_length=100, unique=True)
    channel = models.CharField(
        max_length=10, choices=CHANNEL_CHOICES, default="sms")
    body_template = models.TextField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.code


class NotificationLog(BaseModel):
    """Every attempted notification, regardless of outcome — this is what
    lets you debug 'why didn't the customer get their SMS' later, and is
    also the natural place to retry failed sends."""
    template = models.ForeignKey(
        NotificationTemplate, null=True, blank=True, on_delete=models.SET_NULL
    )
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES)
    recipient = models.CharField(max_length=100)  # phone number or email
    message = models.TextField()
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default="pending")
    branch = models.ForeignKey(
        "tenants.Branch", null=True, blank=True, on_delete=models.SET_NULL
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    def __str__(self):
        return f"{self.channel} to {self.recipient} [{self.status}]"
