// ==============================================================================
// FGP-Backend Domain Event Architecture
// In-process strongly-typed asynchronous domain event bus
// ==============================================================================

import EventEmitter from 'node:events';
import { logger } from '../logging/logger.ts';

export type DomainEventType =
  | 'ROUND_OPENED'
  | 'ROUND_LOCKED'
  | 'RESULT_DECLARED'
  | 'ROUND_SETTLED'
  | 'PLAYER_ENTRY_CREATED'
  | 'CREDIT_TRANSACTION_CREATED'
  | 'GAME_CONFIGURATION_PUBLISHED'
  | 'GAME_STATUS_CHANGED'
  | 'ANNOUNCEMENT_PUBLISHED';

export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
  type: DomainEventType;
  payload: T;
  timestamp: string;
  source: string;
  correlationId?: string;
}

export type DomainEventHandler<T = Record<string, unknown>> = (event: DomainEvent<T>) => Promise<void> | void;

export class DomainEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  public publish<T = Record<string, unknown>>(
    type: DomainEventType,
    payload: T,
    source = 'fgp-backend',
    correlationId?: string
  ): DomainEvent<T> {
    const event: DomainEvent<T> = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
      source,
      correlationId,
    };

    logger.debug({ eventType: type, eventId: event.id, correlationId }, 'Domain event published');

    // Emit event asynchronously to decouple publisher from subscribers
    setImmediate(() => {
      this.emitter.emit(type, event);
      this.emitter.emit('*', event);
    });

    return event;
  }

  public subscribe<T = Record<string, unknown>>(
    type: DomainEventType | '*',
    handler: DomainEventHandler<T>
  ): () => void {
    const safeWrapper = async (event: DomainEvent<T>) => {
      try {
        await handler(event);
      } catch (err) {
        logger.error({ err, eventType: event.type, eventId: event.id }, 'Error executing domain event handler');
      }
    };

    this.emitter.on(type, safeWrapper);
    return () => {
      this.emitter.off(type, safeWrapper);
    };
  }
}

export const eventBus = new DomainEventBus();
