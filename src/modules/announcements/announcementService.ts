// ==============================================================================
// FGP-Backend Announcements Service
// Broadcast communications to players and operators via repository
// ==============================================================================

import { getRepositories } from '../../infrastructure/repositories/index.ts';
import { AnnouncementEntity } from '../../infrastructure/repositories/interfaces/IAuditRepository.ts';
import { UserRole } from '../../shared/types/index.ts';
import { eventBus } from '../../infrastructure/events/eventBus.ts';

export class AnnouncementService {
  public async listActive(role?: UserRole): Promise<AnnouncementEntity[]> {
    return getRepositories().announcementRepo.listActive(role);
  }

  public async createAnnouncement(params: {
    title: string;
    content: string;
    targetRole?: UserRole;
    priority?: number;
    expiresAt?: Date;
  }): Promise<AnnouncementEntity> {
    const entity = await getRepositories().announcementRepo.create(params);

    eventBus.publish('ANNOUNCEMENT_PUBLISHED', {
      announcementId: entity.id,
      title: params.title,
      targetRole: params.targetRole,
    });

    return entity;
  }

  public async archiveAnnouncement(id: string): Promise<void> {
    return getRepositories().announcementRepo.deactivate(id);
  }
}

export const announcementService = new AnnouncementService();
