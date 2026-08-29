# backend/apps/reports/views.py

from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, Count
from django.db.models.functions import TruncDate
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.sales.models import Sale, SaleItem
from apps.expenses.models import Expense
from apps.inventory.models import StockLevel
from apps.tenants.models import Branch

LOW_STOCK_THRESHOLD = 10


def get_active_branch(request):
    branch_id = request.headers.get("X-Active-Branch")
    if branch_id:
        return Branch.objects.filter(id=branch_id).first()
    return None


class DashboardSummaryView(APIView):
    """
    GET /api/reports/summary/?days=7

    Aggregates real numbers directly from `sales` and `expenses` —
    deliberately NOT sourced from the accounting ledger. Only expenses
    currently auto-post journal entries (via a signal in the accounting
    app); sales/purchases don't yet, pending the FIFO vs weighted-average
    inventory valuation decision for COGS. Once that integration exists,
    this view is a natural candidate to switch to reading from
    JournalEntry instead, for a fully ledger-consistent P&L.
    """

    def get_required_feature(self, request, view=None):
        return "reports.view_financial"

    def get(self, request):
        days = int(request.query_params.get("days", 7))
        since = timezone.now() - timedelta(days=days)
        branch = get_active_branch(request)

        sales_qs = Sale.objects.filter(status="completed", sold_at__gte=since)
        expenses_qs = Expense.objects.filter(expense_date__gte=since.date())
        stock_qs = StockLevel.objects.all()

        if branch:
            sales_qs = sales_qs.filter(branch=branch)
            expenses_qs = expenses_qs.filter(branch=branch)
            stock_qs = stock_qs.filter(branch=branch)

        sales_agg = sales_qs.aggregate(
            total=Sum("total_amount"), count=Count("id"))
        expenses_agg = expenses_qs.aggregate(total=Sum("amount"))

        sales_total = sales_agg["total"] or 0
        sales_count = sales_agg["count"] or 0
        expenses_total = expenses_agg["total"] or 0

        low_stock = stock_qs.filter(
            quantity__gt=0, quantity__lte=LOW_STOCK_THRESHOLD).count()
        out_of_stock = stock_qs.filter(quantity__lte=0).count()

        daily = (
            sales_qs
            .annotate(day=TruncDate("sold_at"))
            .values("day")
            .annotate(total=Sum("total_amount"))
            .order_by("day")
        )

        return Response({
            "period_days": days,
            "sales_total": sales_total,
            "sales_count": sales_count,
            "avg_sale": (sales_total / sales_count) if sales_count else 0,
            "expenses_total": expenses_total,
            "gross_profit": sales_total - expenses_total,
            "low_stock_count": low_stock,
            "out_of_stock_count": out_of_stock,
            "daily_sales": [{"date": str(d["day"]), "total": d["total"]} for d in daily],
        })


class TopProductsView(APIView):
    """GET /api/reports/top-products/?days=30&limit=5"""

    def get_required_feature(self, request, view=None):
        return "reports.view_financial"

    def get(self, request):
        days = int(request.query_params.get("days", 30))
        limit = int(request.query_params.get("limit", 5))
        since = timezone.now() - timedelta(days=days)
        branch = get_active_branch(request)

        qs = SaleItem.objects.filter(
            sale__status="completed", sale__sold_at__gte=since)
        if branch:
            qs = qs.filter(sale__branch=branch)

        top = (
            qs.values("product__sku", "product__name")
            .annotate(quantity_sold=Sum("quantity"), revenue=Sum("line_total"))
            .order_by("-quantity_sold")[:limit]
        )

        return Response([
            {
                "sku": row["product__sku"],
                "name": row["product__name"],
                "quantity_sold": row["quantity_sold"],
                "revenue": row["revenue"],
            }
            for row in top
        ])
