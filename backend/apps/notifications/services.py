# backend/apps/notifications/services.py

from django.conf import settings
from django.utils import timezone
from django.utils.module_loading import import_string

from .models import NotificationTemplate, NotificationLog
from .providers import ConsoleSMSProvider


def _get_provider():
    """Reads settings.SMS_PROVIDER (a dotted path string) if set, otherwise
    falls back to the console provider — so local dev needs zero config."""
    provider_path = getattr(settings, "SMS_PROVIDER", None)
    if provider_path:
        provider_class = import_string(provider_path)
        return provider_class()
    return ConsoleSMSProvider()


def send_notification(template_code, recipient, context=None, branch=None):
    """
    The one function every other app should call to send an SMS/notification.
    Never import a specific provider elsewhere in the codebase — this
    function is the only place that decides which provider to use.
    """
    context = context or {}
    template = NotificationTemplate.objects.filter(
        code=template_code, is_active=True).first()

    if template:
        message = template.body_template.format(**context)
        channel = template.channel
    else:
        # No template found — still allow sending a raw message if the
        # caller passed one directly via context["message"], but log it
        # clearly so missing templates get noticed and fixed.
        message = context.get("message", "")
        channel = context.get("channel", "sms")

    log = NotificationLog.objects.create(
        template=template,
        channel=channel,
        recipient=recipient,
        message=message,
        branch=branch,
        status="pending",
    )

    if channel == "sms":
        provider = _get_provider()
        success = provider.send(recipient, message)
    else:
        success = False  # email/other channels not implemented yet

    log.status = "sent" if success else "failed"
    log.sent_at = timezone.now() if success else None
    log.save(update_fields=["status", "sent_at"])

    return log
