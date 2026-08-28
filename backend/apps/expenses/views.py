# backend/apps/expenses/views.py

from rest_framework import viewsets
from apps.core.pagination import StandardResultsSetPagination
from apps.tenants.models import Branch, Organization
from .models import ExpenseCategory, Expense
from .serializers import ExpenseCategorySerializer, ExpenseSerializer


def get_active_branch(request):
    branch_id = request.headers.get("X-Active-Branch")
    if branch_id:
        branch = Branch.objects.filter(id=branch_id).first()
        if branch:
            return branch
    return Branch.objects.first()


def resolve_organization(request):
    branch = get_active_branch(request)
    if branch:
        return branch.organization
    return Organization.objects.first()


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all().order_by("name")
    serializer_class = ExpenseCategorySerializer
    pagination_class = StandardResultsSetPagination

    def get_required_feature(self, request, view):
        return "expenses.view" if request.method in ("GET", "HEAD", "OPTIONS") else "expenses.create"

    def perform_create(self, serializer):
        # organization isn't exposed to the client at all (see serializer) —
        # always resolve it here rather than conditionally.
        serializer.save(organization=resolve_organization(self.request))


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related(
        "category", "branch").order_by("-expense_date")
    serializer_class = ExpenseSerializer
    pagination_class = StandardResultsSetPagination

    def get_required_feature(self, request, view):
        return "expenses.view" if request.method in ("GET", "HEAD", "OPTIONS") else "expenses.create"

    def perform_create(self, serializer):
        extra = {"created_by": self.request.user}
        if not serializer.validated_data.get("branch"):
            extra["branch"] = get_active_branch(self.request)
        serializer.save(**extra)
