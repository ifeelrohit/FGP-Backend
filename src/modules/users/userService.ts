// ==============================================================================
// FGP-Backend User Service
// Authoritative user lifecycle, resolution, and status management via Repository
// ==============================================================================

import { getRepositories } from '../../infrastructure/repositories/index.ts';
import { IUserRepository, UserEntity } from '../../infrastructure/repositories/interfaces/IUserRepository.ts';
import { NotFoundError } from '../../shared/errors/index.ts';
import { UserRole, UserStatus } from '../../shared/types/index.ts';

export class UserService {
  private get repo(): IUserRepository {
    return getRepositories().userRepo;
  }

  public async createUser(data: {
    email: string;
    username: string;
    passwordHash: string;
    role?: UserRole;
  }): Promise<UserEntity> {
    const { user } = await this.repo.createWithInitialCredits(
      {
        email: data.email.toLowerCase(),
        username: data.username,
        passwordHash: data.passwordHash,
        role: data.role || 'PLAYER',
        status: 'ACTIVE',
      },
      10000.0 // Initial simulated demo credits
    );

    return user;
  }

  public async findById(id: string): Promise<UserEntity | null> {
    return this.repo.findById(id);
  }

  public async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findByEmail(email.toLowerCase());
  }

  public async findByUsername(username: string): Promise<UserEntity | null> {
    return this.repo.findByUsername(username);
  }

  public async findByLogin(login: string): Promise<UserEntity | null> {
    if (login.includes('@')) {
      return this.findByEmail(login);
    }
    return this.findByUsername(login);
  }

  public async updateLastLogin(id: string): Promise<void> {
    return this.repo.updateLastLogin(id);
  }

  public async updateUserStatus(id: string, status: UserStatus): Promise<UserEntity> {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new NotFoundError(`User with id '${id}' not found`);
    }
    const updatedUser = await this.repo.updateStatus(id, status);

    // If user is suspended or disabled, immediately revoke all active refresh tokens
    if (status === 'SUSPENDED' || status === 'DISABLED') {
      const tokenRepo = getRepositories().refreshTokenRepo;
      await tokenRepo.revokeAllForUser(id);
    }

    return updatedUser;
  }

  public async listUsers(): Promise<UserEntity[]> {
    return this.repo.listAll();
  }
}

export const userService = new UserService();
