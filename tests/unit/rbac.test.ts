import { describe, it, expect } from 'vitest';
import { hasPermission, ROLE_PERMISSIONS } from '../../src/shared/constants/permissions.ts';

describe('RBAC Roles & Permissions Mapping', () => {
  it('SUPER_ADMIN should have all platform permissions', () => {
    expect(hasPermission('SUPER_ADMIN', 'dashboard.view')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'games.edit')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'configuration.publish')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'players.adjust')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'admin_users.manage')).toBe(true);
  });

  it('OPERATIONS_ADMIN should have operational permissions but not config rollback or admin user management', () => {
    expect(hasPermission('OPERATIONS_ADMIN', 'dashboard.view')).toBe(true);
    expect(hasPermission('OPERATIONS_ADMIN', 'games.maintenance')).toBe(true);
    expect(hasPermission('OPERATIONS_ADMIN', 'players.adjust')).toBe(true);
    expect(hasPermission('OPERATIONS_ADMIN', 'admin_users.manage')).toBe(false);
    expect(hasPermission('OPERATIONS_ADMIN', 'configuration.publish')).toBe(false);
  });

  it('CONFIGURATION_ADMIN should have configuration permissions but not player adjustment', () => {
    expect(hasPermission('CONFIGURATION_ADMIN', 'configuration.edit')).toBe(true);
    expect(hasPermission('CONFIGURATION_ADMIN', 'configuration.publish')).toBe(true);
    expect(hasPermission('CONFIGURATION_ADMIN', 'configuration.rollback')).toBe(true);
    expect(hasPermission('CONFIGURATION_ADMIN', 'players.adjust')).toBe(false);
  });

  it('VIEWER should only have read/view permissions', () => {
    expect(hasPermission('VIEWER', 'dashboard.view')).toBe(true);
    expect(hasPermission('VIEWER', 'games.view')).toBe(true);
    expect(hasPermission('VIEWER', 'games.edit')).toBe(false);
    expect(hasPermission('VIEWER', 'players.adjust')).toBe(false);
  });

  it('PLAYER should have zero administrative permissions', () => {
    expect(ROLE_PERMISSIONS.PLAYER.length).toBe(0);
    expect(hasPermission('PLAYER', 'dashboard.view')).toBe(false);
  });
});
