// ==============================================================================
// FGP-Backend Game Engine Core Interfaces
// Decoupled from HTTP, database, and presentation concerns
// ==============================================================================

export interface GameActionContext {
  userId: string;
  gameId: string;
  roundId?: string;
  entryAmount: number;
  config: Record<string, unknown>;
  payload: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  state?: Record<string, unknown>;
}

export interface RoundResolution {
  roundId: string;
  gameId: string;
  outcome: Record<string, unknown>;
  payoutMultiplier: number;
  won: boolean;
  rewardAmount: number;
  serverSeed?: string;
  hash?: string;
}

export interface GameEngine {
  readonly gameId: string;

  /**
   * Validates player action parameters against game rules and active configuration
   */
  validateAction(context: GameActionContext): { valid: boolean; error?: string };

  /**
   * Initializes or prepares a round state
   */
  createRoundState(config: Record<string, unknown>): Record<string, unknown>;

  /**
   * Processes intermediate or real-time interactive game actions (e.g. hit, pump, step)
   */
  processAction(context: GameActionContext, currentState: Record<string, unknown>): ActionResult;

  /**
   * Authoritatively resolves round outcome on the server
   */
  resolveResult(context: GameActionContext, roundState?: Record<string, unknown>): RoundResolution;

  /**
   * Computes virtual credit payout for a settled resolution
   */
  settle(resolution: RoundResolution): number;
}
