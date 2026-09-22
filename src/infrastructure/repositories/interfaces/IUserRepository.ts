// ==============================================================================
// IUserRepository Interface
// Authoritative domain repository contract for User accounts & identities
// ==============================================================================

import { UserRole, UserStatus } from '../../../shared/types/index.ts';

export interface UserEntity {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
}

export interface CreateUserDto {
  email: string;
  username: string;
  passwordHash: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface IUserRepository {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByUsername(username: string): Promise<UserEntity | null>;
  createWithInitialCredits(
    dto: CreateUserDto,
    initialCredits: number
  ): Promise<{ user: UserEntity; accountId: string }>;
  updateStatus(id: string, status: UserStatus): Promise<UserEntity>;
  updateLastLogin(id: string): Promise<void>;
  listAll(): Promise<UserEntity[]>;
}
