# backend/apps/catalog/defaults.py

from apps.tenants.models import Branch, Organization


class CurrentOrganizationDefault:
    """
    A DRF field default that resolves the active organization from the
    request's X-Active-Branch header, falling back to the only
    Organization in the database (single-tenant local-dev convenience —
    remove the fallback once a second organization exists).

    Used as a HiddenField default rather than a regular field, because
    DRF's automatic UniqueTogetherValidator (triggered by this model's
    unique_together = ("organization", "sku")) forces every field in that
    constraint to be treated as required UNLESS it has a default — a
    plain `required=False` on the field itself is not enough to exempt it.
    """
    requires_context = True

    def __call__(self, serializer_field):
        request = serializer_field.context.get("request")
        branch_id = request.headers.get("X-Active-Branch") if request else None
        if branch_id:
            branch = Branch.objects.filter(
                id=branch_id).select_related("organization").first()
            if branch:
                return branch.organization
        return Organization.objects.first()

    def __repr__(self):
        return "%s()" % self.__class__.__name__
