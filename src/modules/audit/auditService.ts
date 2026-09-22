// ==============================================================================
// FGP-Backend Audit Service
// Append-only audit logger for administrative and operational actions via repository
// ==============================================================================

import { getRepositories } from '../../infrastructure/repositories/index.ts';
import { AuditLogEntity } from '../../infrastructure/repositories/interfaces/IAuditRepository.ts';
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
  }): Promise<AuditLogEntity> {
    const entry = await getRepositories().auditRepo.create(params);
    logger.info(
      { actorId: params.actorId, action: params.action, targetType: params.targetType, targetId: params.targetId },
      'Audit log recorded'
    );
    return entry;
  }

  public async listLogs(limit = 50): Promise<AuditLogEntity[]> {
    return getRepositories().auditRepo.list(limit);
  }
}

export const auditService = new AuditService();
