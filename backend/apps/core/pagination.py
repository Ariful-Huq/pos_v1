# backend/apps/core/pagination.py

from rest_framework.pagination import PageNumberPagination


class StandardResultsSetPagination(PageNumberPagination):
    """Use this on every ViewSet/APIView list endpoint for a consistent
    pagination shape across the whole API (web and mobile both rely on
    this same response structure)."""
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200
