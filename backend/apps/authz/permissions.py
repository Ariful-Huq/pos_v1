# backend/apps/authz/permissions.py

from rest_framework.permissions import BasePermission
from .services import user_has_feature


def get_active_branch_id(request):
    """
    The frontend sends the currently selected branch via this header.
    Returning None means "no branch context yet" — only global (branch=null)
    roles will apply in that case.
    """
    return request.headers.get("X-Active-Branch")


class HasFeaturePermission(BasePermission):
    """
    Central permission gate for the whole POS API. Every view must declare
    a `required_feature` (a string feature code, e.g. "sales.create") —
    views with no `required_feature` are denied by default (fail closed),
    rather than silently allowing any authenticated user through.

    For per-action requirements (e.g. list needs "sales.view" but destroy
    needs "sales.void"), override `get_required_feature(request, view)` on
    the view instead of hardcoding one `required_feature` attribute.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        get_required = getattr(view, "get_required_feature", None)
        required = get_required(request, view) if callable(get_required) else getattr(
            view, "required_feature", None
        )

        if not required:
            return False  # fail closed: every view must declare a feature

        active_branch_id = get_active_branch_id(request)
        return user_has_feature(request.user, required, active_branch_id)
