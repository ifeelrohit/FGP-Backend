// ==============================================================================
// FGP-Backend User Roles
// ==============================================================================

import { UserRole } from '../types/index.ts';

export const USER_ROLES: Record<UserRole, UserRole> = {
  PLAYER: 'PLAYER',
  SUPER_ADMIN: 'SUPER_ADMIN',
  OPERATIONS_ADMIN: 'OPERATIONS_ADMIN',
  CONFIGURATION_ADMIN: 'CONFIGURATION_ADMIN',
  VIEWER: 'VIEWER',
};

export const ADMIN_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'OPERATIONS_ADMIN',
  'CONFIGURATION_ADMIN',
  'VIEWER',
];

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}
