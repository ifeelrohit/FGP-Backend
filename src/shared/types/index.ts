// ==============================================================================
// FGP-Backend Shared Types
// ==============================================================================

export type UserRole =
  | 'PLAYER'
  | 'SUPER_ADMIN'
  | 'OPERATIONS_ADMIN'
  | 'CONFIGURATION_ADMIN'
  | 'VIEWER';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export type GameCategory = 'PREDICTION' | 'CASINO' | 'REAL_TIME' | 'MINI_GAME';

export type GameStatus = 'ACTIVE' | 'MAINTENANCE' | 'DISABLED';

export type RoundStatus =
  | 'SCHEDULED'
  | 'OPEN'
  | 'LOCKED'
  | 'RESULT_PENDING'
  | 'RESULT_DECLARED'
  | 'SETTLED'
  | 'COMPLETED';

export type ConfigStatus =
  | 'DRAFT'
  | 'VALIDATE'
  | 'PREVIEW'
  | 'APPROVE'
  | 'PUBLISH'
  | 'ACTIVE';

export type TransactionType =
  | 'CREDIT'
  | 'ENTRY'
  | 'REWARD'
  | 'REVERSAL'
  | 'ADJUSTMENT';

export interface RequestMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  error: null;
  meta: RequestMeta;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  error: ApiErrorDetail;
  meta: RequestMeta;
}

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  role: UserRole;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
}
