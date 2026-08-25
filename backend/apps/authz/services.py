# backend/apps/authz/services.py

from django.db.models import Q
from .models import UserBranchRole, RoleFeature


def get_user_feature_codes(user, active_branch_id=None):
    """
    Returns the set of feature codes the user has, given the currently
    active branch (or None for global-only context, e.g. before a branch
    has been selected).

    Superusers bypass feature checks entirely — returning None is used as
    a sentinel the permission class checks for, so we never have to keep
    every feature code in sync with a superuser's "everything" access.
    """
    if user.is_superuser:
        return None  # sentinel: caller should treat None as "all access"

    roles = UserBranchRole.objects.filter(
        Q(branch__isnull=True) | Q(branch_id=active_branch_id),
        user=user,
    ).select_related("role")

    role_ids = roles.values_list("role_id", flat=True)

    return set(
        RoleFeature.objects.filter(role_id__in=role_ids)
        .values_list("feature__code", flat=True)
    )


def user_has_feature(user, feature_code, active_branch_id=None):
    codes = get_user_feature_codes(user, active_branch_id)
    if codes is None:  # superuser sentinel
        return True
    return feature_code in codes
