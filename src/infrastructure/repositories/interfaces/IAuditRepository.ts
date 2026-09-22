// ==============================================================================
// IAuditRepository & IAnnouncementRepository Interfaces
// Append-only audit logs & platform announcements
// ==============================================================================

import { UserRole } from '../../../shared/types/index.ts';

export interface AuditLogEntity {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  requestId?: string | null;
  createdAt: Date;
}

export interface CreateAuditLogDto {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  requestId?: string;
}

export interface AnnouncementEntity {
  id: string;
  title: string;
  content: string;
  targetRole?: UserRole | null;
  priority: number;
  isActive: boolean;
  publishedAt: Date;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAnnouncementDto {
  title: string;
  content: string;
  targetRole?: UserRole;
  priority?: number;
  expiresAt?: Date;
}

export interface IAuditRepository {
  create(dto: CreateAuditLogDto): Promise<AuditLogEntity>;
  list(limit?: number): Promise<AuditLogEntity[]>;
}

export interface IAnnouncementRepository {
  listActive(targetRole?: UserRole): Promise<AnnouncementEntity[]>;
  create(dto: CreateAnnouncementDto): Promise<AnnouncementEntity>;
  deactivate(id: string): Promise<void>;
}
