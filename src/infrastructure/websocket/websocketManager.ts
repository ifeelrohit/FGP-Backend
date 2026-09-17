// ==============================================================================
// FGP-Backend WebSocket Infrastructure & Channel Manager
// Section 27: Clean boundaries for Player & Admin real-time subscriptions
// ==============================================================================

import type { WebSocket } from 'ws';
import { logger } from '../logging/logger.ts';
import { UserRole } from '../../shared/types/index.ts';

export type WebSocketTopic =
  | `game:${string}`
  | `round:${string}`
  | `player:${string}`
  | 'admin:dashboard'
  | 'admin:operations'
  | 'announcements'
  | 'broadcast';

export interface WSClientInfo {
  id: string;
  socket: WebSocket;
  userId?: string;
  role?: UserRole;
  subscriptions: Set<string>;
  connectedAt: Date;
}

export class WebSocketManager {
  private clients = new Map<string, WSClientInfo>();

  public registerClient(socket: WebSocket, userId?: string, role?: UserRole): WSClientInfo {
    const clientId = `ws-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const clientInfo: WSClientInfo = {
      id: clientId,
      socket,
      userId,
      role,
      subscriptions: new Set(['broadcast', 'announcements']),
      connectedAt: new Date(),
    };

    if (userId) {
      clientInfo.subscriptions.add(`player:${userId}`);
    }

    if (role && role !== 'PLAYER') {
      clientInfo.subscriptions.add('admin:dashboard');
      clientInfo.subscriptions.add('admin:operations');
    }

    this.clients.set(clientId, clientInfo);
    logger.info({ clientId, userId, role }, 'WebSocket client registered');

    socket.on('close', () => {
      this.unregisterClient(clientId);
    });

    socket.on('error', (err) => {
      logger.warn({ clientId, err: err.message }, 'WebSocket client socket error');
      this.unregisterClient(clientId);
    });

    return clientInfo;
  }

  public unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      logger.info({ clientId, userId: client.userId }, 'WebSocket client unregistered');
    }
  }

  public subscribe(clientId: string, topic: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    // RBAC guard on admin topics
    if (topic.startsWith('admin:') && (!client.role || client.role === 'PLAYER')) {
      logger.warn({ clientId, topic }, 'Unauthorized subscription attempt to admin topic');
      return false;
    }

    client.subscriptions.add(topic);
    logger.debug({ clientId, topic }, 'Client subscribed to topic');
    return true;
  }

  public unsubscribe(clientId: string, topic: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.delete(topic);
    }
  }

  public broadcast(topic: string, eventType: string, payload: Record<string, unknown>): number {
    const message = JSON.stringify({
      topic,
      event: eventType,
      payload,
      timestamp: new Date().toISOString(),
    });

    let recipientCount = 0;

    for (const client of this.clients.values()) {
      if (client.subscriptions.has(topic) && client.socket.readyState === 1) {
        client.socket.send(message);
        recipientCount++;
      }
    }

    return recipientCount;
  }

  public sendToUser(userId: string, eventType: string, payload: Record<string, unknown>): boolean {
    return this.broadcast(`player:${userId}`, eventType, payload) > 0;
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WebSocketManager();
