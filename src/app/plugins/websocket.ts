// ==============================================================================
// FGP-Backend WebSocket Plugin & Real-Time Event Bridge
// Bridges internal DomainEventBus to WebSocket topic broadcasts
// ==============================================================================

import { FastifyInstance } from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import { wsManager } from '../../infrastructure/websocket/websocketManager.ts';
import { eventBus, DomainEvent } from '../../infrastructure/events/eventBus.ts';
import { authService } from '../../modules/auth/authService.ts';
import { logger } from '../../infrastructure/logging/logger.ts';

export async function websocketPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifyWebSocket);

  // Wire up domain events to WebSocket broadcasts
  eventBus.subscribe('*', (event: DomainEvent) => {
    switch (event.type) {
      case 'ROUND_OPENED':
      case 'ROUND_LOCKED':
      case 'RESULT_DECLARED':
      case 'ROUND_SETTLED': {
        const payload = event.payload as { gameId?: string; roundId?: string };
        if (payload.gameId) wsManager.broadcast(`game:${payload.gameId}`, event.type, event.payload);
        if (payload.roundId) wsManager.broadcast(`round:${payload.roundId}`, event.type, event.payload);
        wsManager.broadcast('broadcast', event.type, event.payload);
        break;
      }
      case 'CREDIT_TRANSACTION_CREATED': {
        const payload = event.payload as { userId?: string };
        if (payload.userId) wsManager.broadcast(`player:${payload.userId}`, 'PLAYER_BALANCE_UPDATED', event.payload);
        break;
      }
      case 'ANNOUNCEMENT_PUBLISHED': {
        wsManager.broadcast('announcements', 'ANNOUNCEMENT_CREATED', event.payload);
        break;
      }
      case 'GAME_STATUS_CHANGED': {
        wsManager.broadcast('broadcast', 'GAME_STATUS_CHANGED', event.payload);
        wsManager.broadcast('admin:operations', 'GAME_STATUS_CHANGED', event.payload);
        break;
      }
      default:
        wsManager.broadcast('broadcast', event.type, event.payload);
        break;
    }
  });

  fastify.get('/ws', { websocket: true }, (socket, req) => {
    // Optional token passed via query param ?token=...
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    let userId: string | undefined;
    let role: import('../../shared/types/index.ts').UserRole | undefined;

    if (token) {
      authService
        .verifyAccessToken(token)
        .then((user) => {
          userId = user.id;
          role = user.role;
          initClient();
        })
        .catch((err) => {
          logger.debug({ err: err.message }, 'Anonymous or invalid token for WebSocket');
          initClient();
        });
    } else {
      initClient();
    }

    function initClient() {
      const client = wsManager.registerClient(socket, userId, role);

      socket.send(
        JSON.stringify({
          type: 'CONNECTED',
          clientId: client.id,
          authenticated: !!userId,
          message: 'Connected to authoritative FGP real-time stream',
          timestamp: new Date().toISOString(),
        })
      );

      socket.on('message', (rawData: Buffer | string) => {
        try {
          const parsed = JSON.parse(rawData.toString());
          if (parsed.action === 'subscribe' && typeof parsed.topic === 'string') {
            const success = wsManager.subscribe(client.id, parsed.topic);
            socket.send(
              JSON.stringify({
                type: 'SUBSCRIPTION_ACK',
                topic: parsed.topic,
                success,
              })
            );
          } else if (parsed.action === 'unsubscribe' && typeof parsed.topic === 'string') {
            wsManager.unsubscribe(client.id, parsed.topic);
            socket.send(
              JSON.stringify({
                type: 'UNSUBSCRIPTION_ACK',
                topic: parsed.topic,
              })
            );
          } else if (parsed.action === 'ping') {
            socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
        } catch {
          socket.send(JSON.stringify({ type: 'ERROR', message: 'Invalid WebSocket message format' }));
        }
      });
    }
  });
}
