// ==============================================================================
// FGP-Backend Authentication & RBAC Fastify PreHandlers
// Validates Bearer access tokens and enforces granular role & permission checks
// ==============================================================================

import { FastifyReply, FastifyRequest } from 'fastify';
import { authService } from '../../modules/auth/authService.ts';
import { AuthenticationError, AuthorizationError } from '../../shared/errors/index.ts';
import { AuthenticatedUser, UserRole } from '../../shared/types/index.ts';
import { hasPermission, Permission } from '../../shared/constants/permissions.ts';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or malformed Authorization header. Expected Bearer token.');
  }

  const token = authHeader.substring(7).trim();
  const user = await authService.verifyAccessToken(token);

  request.user = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status,
  };
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new AuthorizationError(
        `Role '${request.user.role}' is not authorized to access this resource. Allowed: ${allowedRoles.join(', ')}`
      );
    }
  };
}

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!hasPermission(request.user.role, permission)) {
      throw new AuthorizationError(`Role '${request.user.role}' lacks required permission '${permission}'`);
    }
  };
}
