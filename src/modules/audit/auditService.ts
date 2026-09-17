// ==============================================================================
// FGP-Backend Audit Service
// Append-only audit logger for administrative and operational actions
// ==============================================================================

import crypto from 'node:crypto';
import { inMemoryStore, StoredAuditLog } from '../../infrastructure/database/inMemoryStore.ts';
import { logger } from '../../infrastructure/logging/logger.ts';

export class AuditService {
  public async logAction(params: {
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    requestId?: string;
  }): Promise<StoredAuditLog> {
    const entry: StoredAuditLog = {
      id: crypto.randomUUID(),
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
      metadata: params.metadata,
      ipAddress: params.ipAddress,
      requestId: params.requestId,
      createdAt: new Date(),
    };

    inMemoryStore.auditLogs.push(entry);
    logger.info(
      { actorId: params.actorId, action: params.action, targetType: params.targetType, targetId: params.targetId },
      'Audit log recorded'
    );

    return entry;
  }

  public async listLogs(limit = 50): Promise<StoredAuditLog[]> {
    return inMemoryStore.auditLogs.slice(-limit).reverse();
  }
}

export const auditService = new AuditService();
