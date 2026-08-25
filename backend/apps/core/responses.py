# backend/apps/core/responses.py

from rest_framework.response import Response


def success_response(data=None, message="", status=200):
    """Consistent success envelope for every endpoint in the project —
    both the React web app and the React Native mobile app can rely on
    this exact shape (success/message/data) without per-endpoint checks."""
    return Response(
        {"success": True, "message": message, "data": data},
        status=status,
    )


def error_response(message="", errors=None, status=400):
    """Consistent error envelope. `errors` can carry field-level validation
    detail (e.g. DRF serializer.errors) separately from the human-readable
    `message`."""
    return Response(
        {"success": False, "message": message, "errors": errors},
        status=status,
    )
