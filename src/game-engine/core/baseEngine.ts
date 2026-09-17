// ==============================================================================
// FGP-Backend Base Game Engine
// Provides cryptographic server randomness and common validation
// ==============================================================================

import crypto from 'node:crypto';
import { GameActionContext, GameEngine, RoundResolution, ActionResult } from './types.ts';

export abstract class BaseGameEngine implements GameEngine {
  abstract readonly gameId: string;

  public validateAction(context: GameActionContext): { valid: boolean; error?: string } {
    if (context.entryAmount <= 0) {
      return { valid: false, error: 'Entry amount must be greater than zero' };
    }
    return { valid: true };
  }

  public createRoundState(_config: Record<string, unknown>): Record<string, unknown> {
    return {
      createdAt: new Date().toISOString(),
      serverSeed: crypto.randomBytes(16).toString('hex'),
    };
  }

  public processAction(_context: GameActionContext, currentState: Record<string, unknown>): ActionResult {
    return { success: true, state: currentState };
  }

  abstract resolveResult(context: GameActionContext, roundState?: Record<string, unknown>): RoundResolution;

  public settle(resolution: RoundResolution): number {
    return resolution.rewardAmount;
  }

  protected generateSecureRandomInt(min: number, max: number): number {
    return crypto.randomInt(min, max + 1);
  }

  protected generateSecureRandomFloat(): number {
    const buffer = crypto.randomBytes(4);
    return buffer.readUInt32LE(0) / 0xffffffff;
  }
}
