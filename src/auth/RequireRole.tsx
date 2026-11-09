import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { getRoles } from './keycloak';

/** renders the children only if the user has at least one of the roles */
export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const userRoles = getRoles();
  if (roles.length && !roles.some((r) => userRoles.includes(r))) {
    return <Navigate to="/404" replace />;
  }
  return <>{children}</>;
}
