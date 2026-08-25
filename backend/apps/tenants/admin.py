# backend/apps/tenants/admin.py

from django.contrib import admin
from .models import Organization, Branch, Terminal

admin.site.register(Organization)
admin.site.register(Branch)
admin.site.register(Terminal)
