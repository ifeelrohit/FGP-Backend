// ==============================================================================
// FGP-Backend Authoritative Game Engine Registry
// Single lookup mapping all 18 platform game IDs to their specialized engines
// ==============================================================================

import { GameEngine } from './core/types.ts';
import {
  ColorPredictionEngine,
  NumberPredictionEngine,
  OddEvenEngine,
  HiLoEngine,
  DiceEngine,
  NumberWheelEngine,
} from './prediction/predictionEngine.ts';
import { SpinWheelEngine, SlotMachineEngine, RouletteEngine } from './casino/casinoEngine.ts';
import { BlackjackEngine, BaccaratEngine, RummyEngine } from './cards/cardGameEngine.ts';
import { CrashEngine, SpaceCrashEngine } from './realtime/crashEngine.ts';
import { MinesEngine, PlinkoEngine, BalloonEngine, StepPathEngine } from './mini-games/miniGameEngine.ts';

class EngineRegistry {
  private engines = new Map<string, GameEngine>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    // Prediction (6)
    this.register(new ColorPredictionEngine());
    this.register(new NumberPredictionEngine());
    this.register(new OddEvenEngine());
    this.register(new HiLoEngine());
    this.register(new DiceEngine());
    this.register(new NumberWheelEngine());

    // Casino (6)
    this.register(new SpinWheelEngine());
    this.register(new SlotMachineEngine());
    this.register(new RouletteEngine());
    this.register(new BlackjackEngine());
    this.register(new BaccaratEngine());
    this.register(new RummyEngine());

    // Real-Time (2)
    this.register(new CrashEngine());
    this.register(new SpaceCrashEngine());

    // Mini Games (4)
    this.register(new MinesEngine());
    this.register(new PlinkoEngine());
    this.register(new BalloonEngine());
    this.register(new StepPathEngine());
  }

  public register(engine: GameEngine): void {
    this.engines.set(engine.gameId, engine);
  }

  public get(gameId: string): GameEngine | undefined {
    return this.engines.get(gameId);
  }

  public getAllEngines(): GameEngine[] {
    return Array.from(this.engines.values());
  }
}

export const engineRegistry = new EngineRegistry();
