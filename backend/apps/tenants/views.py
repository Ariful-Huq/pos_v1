# backend/apps/tenants/views.py

from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import ProtectedError
from apps.core.pagination import StandardResultsSetPagination
from .models import Organization, Branch
from .serializers import OrganizationSerializer, BranchSerializer


class OrganizationView(APIView):
    """
    /api/tenants/organization/

    Treats Organization as a singleton for now — this deployment serves
    one business. GET returns the first (and expected-only) Organization;
    PATCH updates it. Revisit if this project ever needs to serve
    multiple organizations from one deployment.
    """

    def get_required_feature(self, request, view=None):
        return "settings.manage"

    def get(self, request):
        org = Organization.objects.first()
        if not org:
            return Response({"detail": "No organization exists yet."}, status=404)
        return Response(OrganizationSerializer(org).data)

    def patch(self, request):
        org = Organization.objects.first()
        if not org:
            return Response({"detail": "No organization exists yet."}, status=404)
        serializer = OrganizationSerializer(
            org, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class BranchViewSet(viewsets.ModelViewSet):
    """/api/tenants/branches/"""
    queryset = Branch.objects.all().order_by("name")
    serializer_class = BranchSerializer
    pagination_class = StandardResultsSetPagination

    def get_required_feature(self, request, view):
        return "settings.manage"

    def perform_create(self, serializer):
        # organization isn't exposed to the client — single-org assumption,
        # same as elsewhere in the project (see catalog/purchases/expenses
        # views for the same pattern with their own resolve helpers).
        organization = Organization.objects.first()
        serializer.save(organization=organization)

    def destroy(self, request, *args, **kwargs):
        """
        Branch is referenced with on_delete=PROTECT from Sale, StockMovement,
        JournalEntry, etc. — deleting a branch with any history raises
        ProtectedError at the DB level. Catch it here for a clean error
        instead of a raw 500.
        """
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "This branch has sales, stock, or accounting history and cannot be deleted. Deactivate it instead."},
                status=400,
            )
