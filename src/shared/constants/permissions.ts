// ==============================================================================
// FGP-Backend RBAC Permissions
// Compatible with FGP-Admin prototype specifications
// ==============================================================================

import { UserRole } from '../types/index.ts';

export const PERMISSIONS = [
  'dashboard.view',
  'games.view',
  'games.edit',
  'games.enable',
  'games.disable',
  'games.maintenance',
  'configuration.view',
  'configuration.edit',
  'configuration.validate',
  'configuration.preview',
  'configuration.approve',
  'configuration.publish',
  'configuration.rollback',
  'operations.view',
  'operations.manage',
  'players.view',
  'players.adjust',
  'transactions.view',
  'history.view',
  'announcements.view',
  'announcements.create',
  'announcements.edit',
  'announcements.publish',
  'audit.view',
  'admin_users.view',
  'admin_users.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS],

  OPERATIONS_ADMIN: [
    'dashboard.view',
    'games.view',
    'games.enable',
    'games.disable',
    'games.maintenance',
    'operations.view',
    'operations.manage',
    'players.view',
    'players.adjust',
    'transactions.view',
    'history.view',
    'announcements.view',
    'announcements.create',
    'announcements.edit',
    'announcements.publish',
    'audit.view',
  ],

  CONFIGURATION_ADMIN: [
    'dashboard.view',
    'games.view',
    'games.edit',
    'configuration.view',
    'configuration.edit',
    'configuration.validate',
    'configuration.preview',
    'configuration.approve',
    'configuration.publish',
    'configuration.rollback',
    'history.view',
    'audit.view',
  ],

  VIEWER: [
    'dashboard.view',
    'games.view',
    'configuration.view',
    'operations.view',
    'players.view',
    'transactions.view',
    'history.view',
    'announcements.view',
    'audit.view',
  ],

  PLAYER: [],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}
