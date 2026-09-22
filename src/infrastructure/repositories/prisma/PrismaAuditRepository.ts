// ==============================================================================
// PrismaAuditRepository & PrismaAnnouncementRepository Implementation
// Immutable administrative audit trail & platform broadcast persistence
// ==============================================================================

import { prisma } from '../../database/prisma.ts';
import {
  IAuditRepository,
  IAnnouncementRepository,
  AuditLogEntity,
  CreateAuditLogDto,
  AnnouncementEntity,
  CreateAnnouncementDto,
} from '../interfaces/IAuditRepository.ts';
import { UserRole } from '../../../shared/types/index.ts';

export class PrismaAuditRepository implements IAuditRepository {
  public async create(dto: CreateAuditLogDto): Promise<AuditLogEntity> {
    const row = await prisma.auditLog.create({
      data: {
        actorId: dto.actorId,
        action: dto.action,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        metadata: (dto.metadata || {}) as any,
        ipAddress: dto.ipAddress,
        requestId: dto.requestId,
      },
    });

    return this.mapAudit(row);
  }

  public async list(limit: number = 50): Promise<AuditLogEntity[]> {
    const rows = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(this.mapAudit);
  }

  private mapAudit(row: any): AuditLogEntity {
    return {
      id: row.id,
      actorId: row.actorId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      reason: row.reason,
      metadata: row.metadata as Record<string, unknown> | null,
      ipAddress: row.ipAddress,
      requestId: row.requestId,
      createdAt: row.createdAt,
    };
  }
}

export class PrismaAnnouncementRepository implements IAnnouncementRepository {
  public async listActive(targetRole?: UserRole): Promise<AnnouncementEntity[]> {
    const rows = await prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [
          { targetRole: null },
          ...(targetRole ? [{ targetRole }] : []),
        ],
      },
      orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
    });
    return rows.map(this.mapAnnouncement);
  }

  public async create(dto: CreateAnnouncementDto): Promise<AnnouncementEntity> {
    const row = await prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        targetRole: dto.targetRole,
        priority: dto.priority ?? 0,
        expiresAt: dto.expiresAt,
        isActive: true,
      },
    });
    return this.mapAnnouncement(row);
  }

  public async deactivate(id: string): Promise<void> {
    await prisma.announcement.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private mapAnnouncement(row: any): AnnouncementEntity {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      targetRole: row.targetRole as UserRole | null,
      priority: row.priority,
      isActive: row.isActive,
      publishedAt: row.publishedAt,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
