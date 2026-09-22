// ==============================================================================
// FGP-Backend Real-Time Crash Engines (Crash & Space Crash)
// Centralized authoritative crash point calculation, multiplier curve, and cashout resolution
// ==============================================================================

import crypto from 'node:crypto';
import { BaseGameEngine } from '../core/baseEngine.ts';
import { GameActionContext, RoundResolution } from '../core/types.ts';
import { BadRequestError } from '../../shared/errors/index.ts';

export interface CashoutEvaluationParams {
  roundId: string;
  entryAmount: number;
  roundCrashPoint?: number | null;
  elapsedSeconds?: number;
  requestedAutoCashoutMultiplier?: number;
  config?: Record<string, any>;
}

export interface CrashEvaluationResult {
  won: boolean;
  payoutMultiplier: number;
  rewardAmount: number;
  authoritativeMultiplier: number;
  crashPoint: number;
  outcome: Record<string, unknown>;
}

export class CrashEngine extends BaseGameEngine {
  readonly gameId: string;

  constructor(gameId = 'crash') {
    super();
    this.gameId = gameId;
  }

  /**
   * Authoritative, deterministic crash multiplier generation using provably fair SHA-256 hash.
   * Single source of truth across all services. Driven by configuration (RTP / house edge / maxPayout).
   */
  public generateAuthoritativeCrashPoint(serverSeed: string, config?: Record<string, any>): number {
    const hash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const hexSlice = hash.substring(0, 8);
    const intVal = Number.parseInt(hexSlice, 16);

    // 1 in 101 chance of immediate 1.00x bust
    if (intVal % 101 === 0) {
      return 1.0;
    }

    const rewardConfig = (config?.rewardConfig || {}) as Record<string, any>;
    const rtp = rewardConfig.rtp ?? (rewardConfig.houseEdge !== undefined ? 1 - rewardConfig.houseEdge : 0.97);
    const maxMultiplier = rewardConfig.maxPayoutMultiplier ?? 250.0;

    // Standard inverse house edge curve
    const floatVal = (intVal % 1000000) / 1000000;
    const crashMultiplier = Math.floor((rtp / (1 - floatVal)) * 100) / 100;

    return Math.max(1.0, Math.min(crashMultiplier, maxMultiplier));
  }

  /**
   * Authoritative multiplier curve based on elapsed round duration.
   * Single source of truth: e^(growthRate * elapsedSeconds). Driven by configuration.
   */
  public calculateCurrentMultiplier(elapsedSeconds: number, config?: Record<string, any>): number {
    const elapsed = Math.max(0, elapsedSeconds);
    const growthRate = config?.ruleConfig?.growthRate ?? 0.06;
    const raw = Math.pow(Math.E, growthRate * elapsed);
    return Math.round(raw * 100) / 100;
  }

  /**
   * Server-authoritative cashout evaluation.
   * Strictly enforces authoritative roundCrashPoint without magic fallbacks (never 1.5 or 1.0).
   * Rejects client-supplied multipliers and calculates true server multiplier.
   */
  public evaluateCashout(params: CashoutEvaluationParams): CrashEvaluationResult {
    if (
      params.roundCrashPoint === undefined ||
      params.roundCrashPoint === null ||
      Number.isNaN(Number(params.roundCrashPoint))
    ) {
      throw new BadRequestError(
        `Authoritative crash point missing for round '${params.roundId}'. System refuses to settle using invented outcomes.`
      );
    }

    const crashPoint = Number(params.roundCrashPoint);
    const currentMultiplier = this.calculateCurrentMultiplier(params.elapsedSeconds ?? 0, params.config);

    // Client can only request an autoCashoutMultiplier target; server validates if reached
    let effectiveMultiplier = currentMultiplier;
    if (
      params.requestedAutoCashoutMultiplier !== undefined &&
      !Number.isNaN(params.requestedAutoCashoutMultiplier) &&
      params.requestedAutoCashoutMultiplier > 1.0
    ) {
      if (params.requestedAutoCashoutMultiplier <= currentMultiplier) {
        effectiveMultiplier = params.requestedAutoCashoutMultiplier;
      }
    }

    const authoritativeMultiplier = Math.max(1.0, effectiveMultiplier);
    const won = authoritativeMultiplier <= crashPoint;
    const payoutMultiplier = won ? authoritativeMultiplier : 0;
    const rewardAmount = won ? Math.floor(params.entryAmount * payoutMultiplier * 100) / 100 : 0;

    return {
      won,
      payoutMultiplier,
      rewardAmount,
      authoritativeMultiplier,
      crashPoint,
      outcome: {
        crashPoint,
        authoritativeMultiplier,
        cashedOut: won,
      },
    };
  }

  /**
   * Resolves round outcome using the ROUND's authoritative predetermined crash point.
   */
  public override resolveResult(
    context: GameActionContext,
    roundState?: Record<string, unknown>
  ): RoundResolution {
    const roundCrashPoint =
      roundState?.crashPoint !== undefined && roundState?.crashPoint !== null
        ? Number(roundState.crashPoint)
        : undefined;

    if (roundCrashPoint === undefined || Number.isNaN(roundCrashPoint)) {
      throw new BadRequestError(
        `Authoritative crash point missing for round '${context.roundId}'. System refuses to settle using invented outcomes.`
      );
    }

    const elapsedSeconds =
      roundState?.elapsedSeconds !== undefined ? Number(roundState.elapsedSeconds) : 0;

    const requestedAutoCashout =
      context.payload?.autoCashoutMultiplier !== undefined
        ? Number(context.payload.autoCashoutMultiplier)
        : undefined;

    const evaluation = this.evaluateCashout({
      roundId: context.roundId || 'unknown',
      entryAmount: context.entryAmount,
      roundCrashPoint,
      elapsedSeconds,
      requestedAutoCashoutMultiplier: requestedAutoCashout,
      config: context.config,
    });

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: {
        ...evaluation.outcome,
        serverSeedHash: roundState?.serverSeed
          ? crypto.createHash('sha256').update(roundState.serverSeed as string).digest('hex')
          : undefined,
      },
      payoutMultiplier: evaluation.payoutMultiplier,
      won: evaluation.won,
      rewardAmount: evaluation.rewardAmount,
      serverSeed: roundState?.serverSeed as string | undefined,
    };
  }
}

export class SpaceCrashEngine extends CrashEngine {
  constructor() {
    super('space_crash');
  }
}
