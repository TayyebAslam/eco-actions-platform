"use client";

import { usePermissions } from "@/hooks/usePermissions";
import { AccessDeniedView } from "@/components/views/errors/AccessDeniedView";

interface SuperAdminGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * A guard component that protects routes for Super Admin only.
 * Shows AccessDeniedView if user is not a Super Admin.
 */
export function SuperAdminGuard({ children, fallback }: SuperAdminGuardProps) {
  const { isSuperAdmin } = usePermissions();

  if (!isSuperAdmin) {
    return fallback || (
      <AccessDeniedView
        message="This page is only accessible to Super Admins. Contact your administrator if you need access."
      />
    );
  }

  return <>{children}</>;
}
