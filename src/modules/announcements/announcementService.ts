// ==============================================================================
// FGP-Backend Announcements Service
// Broadcast communications to players and operators
// ==============================================================================

import crypto from 'node:crypto';
import { inMemoryStore, StoredAnnouncement } from '../../infrastructure/database/inMemoryStore.ts';
import { NotFoundError } from '../../shared/errors/index.ts';
import { UserRole } from '../../shared/types/index.ts';
import { eventBus } from '../../infrastructure/events/eventBus.ts';

export class AnnouncementService {
  public async listActive(role?: UserRole): Promise<StoredAnnouncement[]> {
    return Array.from(inMemoryStore.announcements.values())
      .filter((a) => a.isActive && (!a.targetRole || a.targetRole === role))
      .sort((a, b) => b.priority - a.priority);
  }

  public async createAnnouncement(params: {
    title: string;
    content: string;
    targetRole?: UserRole;
    priority?: number;
    expiresAt?: Date;
  }): Promise<StoredAnnouncement> {
    const id = `ann-${Date.now()}`;
    const announcement: StoredAnnouncement = {
      id,
      title: params.title,
      content: params.content,
      targetRole: params.targetRole,
      priority: params.priority || 0,
      isActive: true,
      publishedAt: new Date(),
      expiresAt: params.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    inMemoryStore.announcements.set(id, announcement);

    eventBus.publish('ANNOUNCEMENT_PUBLISHED', {
      announcementId: id,
      title: params.title,
      targetRole: params.targetRole,
    });

    return announcement;
  }

  public async archiveAnnouncement(id: string): Promise<StoredAnnouncement> {
    const ann = inMemoryStore.announcements.get(id);
    if (!ann) {
      throw new NotFoundError(`Announcement '${id}' not found`);
    }
    ann.isActive = false;
    ann.updatedAt = new Date();
    return ann;
  }
}

export const announcementService = new AnnouncementService();
