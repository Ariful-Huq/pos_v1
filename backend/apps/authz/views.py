# backend/apps/authz/views.py

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import UserBranchRole


class MeView(APIView):
    """
    Called right after login. Returns the user's identity plus every
    (branch, role) pair they have access to — this is what the frontend
    uses to build the branch switcher and to know which roles apply where.

    Explicitly overrides the project-wide default permission
    (HasFeaturePermission, which fails closed without a required_feature)
    with plain IsAuthenticated — every logged-in user is allowed to see
    their own access summary, that's not a feature-gated action.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        roles = UserBranchRole.objects.filter(
            user=user).select_related("role", "branch")

        branch_access = [
            {
                "branch_id": str(ubr.branch.id) if ubr.branch else None,
                "branch_name": ubr.branch.name if ubr.branch else "All Branches",
                "branch_code": ubr.branch.code if ubr.branch else None,
                "role_code": ubr.role.code,
                "role_name": ubr.role.name,
            }
            for ubr in roles
        ]

        return Response({
            "id": user.id,
            "username": user.username,
            "full_name": user.get_full_name(),
            "is_superuser": user.is_superuser,
            "branch_access": branch_access,
        })
