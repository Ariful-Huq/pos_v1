# backend/apps/staff/views.py

from django.contrib.auth import get_user_model
from rest_framework import viewsets, status
from rest_framework.response import Response
from apps.core.pagination import StandardResultsSetPagination
from .models import StaffProfile
from .serializers import StaffProfileSerializer

User = get_user_model()


class StaffProfileViewSet(viewsets.ModelViewSet):
    """
    /api/staff/staff/

    NOTE: creating a staff member also creates their login (Django User)
    in the same request — this is intentionally NOT a plain ModelSerializer
    create, since it spans two models. Editing an existing staff member
    only updates their StaffProfile fields (employee_id, phone,
    designation, etc.) — changing their username/password/name is not
    supported yet through this endpoint.

    Role/branch access (who they can log in as, what they can do) is a
    completely separate concern handled by apps.authz.UserBranchRole —
    creating a StaffProfile here does NOT grant any permissions by itself.
    """
    queryset = StaffProfile.objects.select_related(
        "user", "primary_branch").order_by("user__username")
    serializer_class = StaffProfileSerializer
    pagination_class = StandardResultsSetPagination

    def get_required_feature(self, request, view):
        # Single feature code covers both view and manage for staff, per
        # the current seed data — split into staff.view/staff.manage later
        # if finer-grained access turns out to matter.
        return "staff.manage"

    def create(self, request, *args, **kwargs):
        data = request.data
        username = data.get("username", "").strip()
        employee_id = data.get("employee_id", "").strip()

        if not username or not employee_id:
            return Response({"detail": "username and employee_id are required"}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({"detail": "That username is already taken"}, status=400)
        if StaffProfile.objects.filter(employee_id=employee_id).exists():
            return Response({"detail": "That employee ID is already in use"}, status=400)

        user = User.objects.create_user(
            username=username,
            password=data.get(
                "password") or User.objects.make_random_password(),
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            email=data.get("email", ""),
        )

        profile = StaffProfile.objects.create(
            user=user,
            employee_id=employee_id,
            phone=data.get("phone", ""),
            designation=data.get("designation", ""),
            primary_branch_id=data.get("primary_branch") or None,
            date_joined=data.get("date_joined") or None,
        )

        return Response(StaffProfileSerializer(profile).data, status=status.HTTP_201_CREATED)
