#!/usr/bin/env python3
"""Grant GA4 property access programmatically (works when the UI rejects @iam.gserviceaccount.com).

Uses Analytics Admin API v1alpha: properties.accessBindings.create.

Authenticate the CALLER (someone who can manage users on this property), not the grantee.

`gcloud auth login` does not grant Application Default Credentials or the Analytics
user-admin scope. Use ADC with explicit scopes:

       unset GOOGLE_APPLICATION_CREDENTIALS   # if it pointed at the grantee SA
       gcloud auth application-default login \\
         --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/analytics.manage.users

Alternatively, set GOOGLE_APPLICATION_CREDENTIALS to a *different* service account
key that already has GA4 Administrator on this property.

Requires: pip install google-analytics-admin google-auth

Example:

  python scripts/grant_ga4_property_access.py \\
    --property-id 536088889 \\
    --user epub2epubagent@ai-projects-459309.iam.gserviceaccount.com
"""

from __future__ import annotations

import argparse
import sys

from google.analytics.admin_v1alpha import AnalyticsAdminServiceClient
from google.analytics.admin_v1alpha.types import AccessBinding
from google.auth import default as google_auth_default
from google.auth.exceptions import DefaultCredentialsError

SCOPES = ("https://www.googleapis.com/auth/analytics.manage.users",)

ROLE_CHOICES = (
    "predefinedRoles/viewer",
    "predefinedRoles/analyst",
    "predefinedRoles/editor",
    "predefinedRoles/admin",
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--property-id", required=True)
    parser.add_argument(
        "--user",
        required=True,
        help="Principal email (e.g. service account ...@....iam.gserviceaccount.com)",
    )
    parser.add_argument(
        "--role",
        default="predefinedRoles/viewer",
        choices=ROLE_CHOICES,
    )
    args = parser.parse_args()
    parent = f"properties/{args.property_id}"

    try:
        credentials, _ = google_auth_default(scopes=SCOPES)
    except DefaultCredentialsError as e:
        print(
            "No Application Default Credentials. "
            "Run: gcloud auth application-default login",
            file=sys.stderr,
        )
        raise SystemExit(1) from e

    client = AnalyticsAdminServiceClient(credentials=credentials)
    binding = AccessBinding(user=args.user, roles=[args.role])
    result = client.create_access_binding(parent=parent, access_binding=binding)
    print("Created:", result.name)
    print("User:", result.user)
    print("Roles:", list(result.roles))


if __name__ == "__main__":
    main()
