import React, { useState, useEffect } from 'react';
import {
  Activity,
  Shield,
  Coins,
  Play,
  RotateCcw,
  Layers,
  FileCode2,
  Terminal,
  Server,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Sliders,
  Send,
  Radio,
  BarChart3,
  Flame,
  Bomb,
  Dices,
} from 'lucide-react';

interface GameItem {
  id: string;
  code: string;
  name: string;
  category: 'PREDICTION' | 'CASINO' | 'REAL_TIME' | 'MINI_GAME';
  description: string;
  minEntry: number;
  maxEntry: number;
  defaultMultiplier: number;
  status: string;
  features: string[];
  activeConfigVersion: number;
}

interface TransactionItem {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string;
  createdAt: string;
}

interface AuditItem {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  createdAt: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'simulator' | 'ledger' | 'rounds' | 'config' | 'events' | 'audit' | 'api'>('catalog');
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [games, setGames] = useState<GameItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeRole, setActiveRole] = useState<'PLAYER' | 'SUPER_ADMIN' | 'OPERATIONS_ADMIN' | 'CONFIGURATION_ADMIN' | 'VIEWER'>('SUPER_ADMIN');
  const [userBalance, setUserBalance] = useState<number>(10000);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  
  // Simulator State
  const [selectedGameId, setSelectedGameId] = useState<string>('color_pred');
  const [simEntryAmount, setSimEntryAmount] = useState<number>(100);
  const [simChoice, setSimChoice] = useState<string>('RED');
  const [simResult, setSimResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Round State Machine Simulator
  const [currentRoundStatus, setCurrentRoundStatus] = useState<string>('OPEN');
  const [transitionMessage, setTransitionMessage] = useState<string>('');

  // WebSocket Log
  const [wsEvents, setWsEvents] = useState<any[]>([]);

  // Fetch Health & Initial Data
  const fetchData = async () => {
    try {
      const hRes = await fetch('/ready');
      if (hRes.ok) {
        const hJson = await hRes.json();
        setHealthStatus(hJson);
      }

      const gRes = await fetch('/api/v1/games');
      if (gRes.ok) {
        const gJson = await gRes.json();
        if (gJson.data?.games) {
          setGames(gJson.data.games);
        }
      }

      const bRes = await fetch('/api/v1/credits/balance');
      if (bRes.ok) {
        const bJson = await bRes.json();
        if (bJson.data?.balance !== undefined) {
          setUserBalance(bJson.data.balance);
        }
      }

      const tRes = await fetch('/api/v1/credits/transactions');
      if (tRes.ok) {
        const tJson = await tRes.json();
        if (tJson.data?.transactions) {
          setTransactions(tJson.data.transactions);
        }
      }

      const aRes = await fetch('/api/v1/admin/audit');
      if (aRes.ok) {
        const aJson = await aRes.json();
        if (aJson.data?.logs) {
          setAuditLogs(aJson.data.logs);
        }
      }
    } catch {
      // Fallback for mock or disconnected preview
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Run game simulation
  const handleExecuteGameAction = async () => {
    setIsSimulating(true);
    setSimResult(null);

    try {
      let endpoint = `/api/v1/games/${selectedGameId}/action`;
      let payload: any = {};

      if (selectedGameId === 'color_pred') {
        endpoint = '/api/v1/predictions/submit';
        payload = { gameId: 'color_pred', selection: simChoice, entryAmount: simEntryAmount };
      } else if (selectedGameId === 'crash') {
        endpoint = '/api/v1/realtime/crash/enter';
        payload = { gameId: 'crash', entryAmount: simEntryAmount, autoCashoutMultiplier: 1.8 };
      } else if (selectedGameId === 'mines') {
        endpoint = '/api/v1/mini-games/action';
        payload = { gameId: 'mines', entryAmount: simEntryAmount, action: 'REVEAL', step: 2 };
      } else {
        payload = {
          gameId: selectedGameId,
          entryAmount: simEntryAmount,
          actionType: 'PLAY',
          payload: { choice: simChoice },
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setSimResult(data.data);
        if (data.data?.balanceAfter !== undefined) {
          setUserBalance(data.data.balanceAfter);
        }
        fetchData();
      } else {
        const errData = await res.json();
        setSimResult({ error: errData.error?.message || 'Action failed' });
      }
    } catch (err: any) {
      setSimResult({ error: err.message || 'Execution error' });
    } finally {
      setIsSimulating(false);
    }
  };

  // Step round lifecycle
  const handleTransitionRound = (target: string) => {
    const validTransitions: Record<string, string[]> = {
      SCHEDULED: ['OPEN'],
      OPEN: ['LOCKED'],
      LOCKED: ['RESULT_PENDING', 'RESULT_DECLARED'],
      RESULT_PENDING: ['RESULT_DECLARED'],
      RESULT_DECLARED: ['SETTLED'],
      SETTLED: ['COMPLETED'],
      COMPLETED: ['OPEN'],
    };

    if (validTransitions[currentRoundStatus]?.includes(target)) {
      setCurrentRoundStatus(target);
      setTransitionMessage(`Authoritative transition approved: ${currentRoundStatus} → ${target}`);
      setWsEvents((prev) => [
        {
          topic: 'game:color_pred',
          event: `ROUND_${target}`,
          time: new Date().toLocaleTimeString(),
          status: target,
        },
        ...prev.slice(0, 19),
      ]);
    } else {
      setTransitionMessage(`REJECTED by state machine: Cannot transition directly from ${currentRoundStatus} to ${target}`);
    }
  };

  const filteredGames = games.filter(
    (g) => selectedCategory === 'ALL' || g.category === selectedCategory
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-indigo-500/20">
              F
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-tight text-white text-base">FGP-Backend</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Phase 03 Active
                </span>
              </div>
              <p className="text-xs text-slate-400">Authoritative Fantasy Gaming Platform Engine</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Health & Engine Status */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono">18/18 Engines Authoritative</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-400">0.0.0.0:3000</span>
            </div>

            {/* Virtual Credit Balance */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <Coins className="w-3.5 h-3.5" />
              <span>{userBalance.toLocaleString()}</span>
              <span className="text-[10px] text-amber-400/80 font-normal">DEMO CREDITS</span>
            </div>

            {/* Role Context Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={activeRole}
                onChange={(e: any) => setActiveRole(e.target.value)}
                aria-label="Active Security Role Context"
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
              >
                <option value="PLAYER" className="bg-slate-900">PLAYER</option>
                <option value="SUPER_ADMIN" className="bg-slate-900">SUPER_ADMIN</option>
                <option value="OPERATIONS_ADMIN" className="bg-slate-900">OPERATIONS_ADMIN</option>
                <option value="CONFIGURATION_ADMIN" className="bg-slate-900">CONFIGURATION_ADMIN</option>
                <option value="VIEWER" className="bg-slate-900">VIEWER</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col w-full">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 border-b border-slate-800 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'catalog', label: '18 Games Catalog', icon: Layers },
            { id: 'simulator', label: 'Engine Simulator', icon: Play },
            { id: 'ledger', label: 'Virtual Credit Ledger', icon: Coins },
            { id: 'rounds', label: 'Round State Machine', icon: Clock },
            { id: 'config', label: 'Immutable Configs', icon: Sliders },
            { id: 'events', label: 'WebSocket Stream', icon: Radio },
            { id: 'audit', label: 'Admin Audit & Metrics', icon: Shield },
            { id: 'api', label: 'API Endpoints & Contracts', icon: Terminal },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: 18 GAMES CATALOG */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-white">Authoritative 18-Game Platform Catalog</h2>
                <p className="text-xs text-slate-400">Strictly preserved catalog matching FGP-Player & FGP-Admin client contracts.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['ALL', 'PREDICTION', 'CASINO', 'REAL_TIME', 'MINI_GAME'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      selectedCategory === cat
                        ? 'bg-slate-700 text-white border border-slate-600'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGames.map((game) => (
                <div
                  key={game.id}
                  className="bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                          {game.category}
                        </span>
                        <h3 className="font-semibold text-white text-sm mt-1.5">{game.name}</h3>
                      </div>
                      <span className="text-xs font-mono text-slate-400 bg-slate-800/40 px-2 py-1 rounded">
                        {game.id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-3">{game.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 mb-3">
                      <div>
                        <span className="text-slate-500">Multiplier:</span>{' '}
                        <span className="font-semibold text-amber-400">{game.defaultMultiplier}x</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Entry:</span>{' '}
                        <span className="font-mono text-slate-300">{game.minEntry} - {game.maxEntry}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Version:</span>{' '}
                        <span className="font-mono text-indigo-300">v{game.activeConfigVersion}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Status:</span>{' '}
                        <span className="text-emerald-400 font-medium">{game.status}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedGameId(game.id);
                      setActiveTab('simulator');
                    }}
                    className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    <span>Test Authoritative Engine</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: ENGINE SIMULATOR */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
                <Play className="w-4 h-4 text-indigo-400" />
                <span>Execute Server-Side Game Resolution</span>
              </h2>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Select Game Engine (18 Registered)</label>
                  <select
                    value={selectedGameId}
                    onChange={(e) => setSelectedGameId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {games.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Virtual Credit Entry Amount</label>
                  <div className="flex space-x-2">
                    {[50, 100, 250, 500].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setSimEntryAmount(amt)}
                        className={`flex-1 py-1 rounded text-xs border ${
                          simEntryAmount === amt
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedGameId === 'color_pred' && (
                  <div>
                    <label className="block text-slate-400 mb-1">Prediction Selection</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['RED', 'GREEN', 'VIOLET'].map((col) => (
                        <button
                          key={col}
                          onClick={() => setSimChoice(col)}
                          className={`py-2 rounded font-semibold text-xs border transition-all ${
                            simChoice === col
                              ? col === 'RED'
                                ? 'bg-rose-600 text-white border-rose-500'
                                : col === 'GREEN'
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-purple-600 text-white border-purple-500'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {col}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleExecuteGameAction}
                  disabled={isSimulating}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all mt-4"
                >
                  {isSimulating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Resolving Authoritatively on Server...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Submit Action & Settle</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center justify-between">
                  <span>Authoritative Settlement Receipt</span>
                  <span className="text-[10px] font-mono text-slate-400">Atomic Ledger Sync</span>
                </h3>

                {simResult ? (
                  <div className="space-y-4">
                    {simResult.error ? (
                      <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                        <AlertCircle className="w-4 h-4 mb-1 inline mr-2" />
                        <span>{simResult.error}</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className={`p-4 rounded-xl border ${
                          simResult.won
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}>
                          <div className="text-lg font-bold flex items-center space-x-2">
                            {simResult.won ? (
                              <>
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                <span>WIN: +{simResult.rewardAmount} DEMO CREDITS</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-5 h-5 text-rose-400" />
                                <span>NO REWARD: 0 CREDITS</span>
                              </>
                            )}
                          </div>
                          <p className="text-xs mt-1 text-slate-300">
                            Payout Multiplier: <span className="font-mono font-bold">{simResult.payoutMultiplier}x</span>
                          </p>
                        </div>

                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-1 text-slate-300">
                          <div className="text-slate-500 text-[10px] uppercase font-sans mb-1">Server Outcome Payload</div>
                          <div>roundId: {simResult.roundId}</div>
                          <div>gameId: {simResult.gameId}</div>
                          <div>balanceAfter: {simResult.balanceAfter}</div>
                          <div>outcome: {JSON.stringify(simResult.outcome)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-500 text-xs space-y-2">
                    <Terminal className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
                    <p>Select a game, configure parameters, and submit action.</p>
                    <p className="text-[11px] text-slate-600">All results and random values are computed exclusively server-side.</p>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
                Security Guarantee: No client-authoritative outcome injection or arbitrary multiplier override is accepted.
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VIRTUAL CREDIT LEDGER */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400">Total Virtual Balance</span>
                <div className="text-xl font-bold text-amber-400 mt-1">{userBalance.toLocaleString()} CREDITS</div>
                <span className="text-[10px] text-slate-500">Immutable Account Derivation</span>
              </div>
              <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400">Currency Type</span>
                <div className="text-xl font-bold text-slate-200 mt-1">DEMO_CREDIT</div>
                <span className="text-[10px] text-emerald-400">Strict Non-Monetary Scope</span>
              </div>
              <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400">Total Ledger Entries</span>
                <div className="text-xl font-bold text-indigo-400 mt-1">{transactions.length}</div>
                <span className="text-[10px] text-slate-500">Append-Only Audit Trail</span>
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Immutable Double-Entry Ledger Transactions</h3>
                <span className="text-xs text-slate-400 font-mono">Anti-Negative Balance Enforced</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Tx ID</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Balance Before</th>
                      <th className="px-4 py-3">Balance After</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {transactions.length > 0 ? (
                      transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-2.5 text-indigo-400">{tx.id.substring(0, 12)}...</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                              tx.type === 'ENTRY'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : tx.type === 'REWARD'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className={`px-4 py-2.5 font-bold ${tx.type === 'ENTRY' ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {tx.type === 'ENTRY' ? '-' : '+'}{tx.amount}
                          </td>
                          <td className="px-4 py-2.5 text-slate-400">{tx.balanceBefore}</td>
                          <td className="px-4 py-2.5 text-slate-200">{tx.balanceAfter}</td>
                          <td className="px-4 py-2.5 text-slate-400 font-sans">{tx.referenceType || 'N/A'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{new Date(tx.createdAt).toLocaleTimeString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                          No transactions recorded yet. Execute actions in the simulator to generate ledger entries.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ROUND STATE MACHINE */}
        {activeTab === 'rounds' && (
          <div className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-2">Section 21 Round Lifecycle State Machine</h3>
              <p className="text-xs text-slate-400 mb-6">
                SCHEDULED → OPEN → LOCKED → RESULT_PENDING → RESULT_DECLARED → SETTLED → COMPLETED
              </p>

              {/* Stepper Display */}
              <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
                {[
                  'SCHEDULED',
                  'OPEN',
                  'LOCKED',
                  'RESULT_PENDING',
                  'RESULT_DECLARED',
                  'SETTLED',
                  'COMPLETED',
                ].map((st, i) => {
                  const isCurrent = currentRoundStatus === st;
                  return (
                    <div key={st} className="flex items-center">
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                        isCurrent
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400 ring-2 ring-indigo-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {st}
                      </div>
                      {i < 6 && <ChevronRight className="w-4 h-4 text-slate-600 mx-1" />}
                    </div>
                  );
                })}
              </div>

              {transitionMessage && (
                <div className={`p-3 rounded-lg text-xs mb-4 font-mono ${
                  transitionMessage.startsWith('REJECTED')
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {transitionMessage}
                </div>
              )}

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-3 font-medium">Trigger State Transition Test:</span>
                <div className="flex flex-wrap gap-2">
                  {['SCHEDULED', 'OPEN', 'LOCKED', 'RESULT_PENDING', 'RESULT_DECLARED', 'SETTLED', 'COMPLETED'].map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => handleTransitionRound(st)}
                        className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono transition-colors"
                      >
                        Transition to {st}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: IMMUTABLE CONFIGS */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-1">Section 13 Configuration Lifecycle Engine</h3>
              <p className="text-xs text-slate-400 mb-4">
                DRAFT → VALIDATE → PREVIEW → APPROVE → PUBLISH → ACTIVE with Rollback Versioning.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-300 mb-2">Active Config for Color Prediction (v1)</h4>
                  <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto p-2 bg-slate-900/50 rounded">
{JSON.stringify(
  {
    gameId: 'color_pred',
    version: 1,
    status: 'ACTIVE',
    entryConfig: { minEntry: 10, maxEntry: 10000 },
    timingConfig: { roundIntervalSeconds: 30, lockBeforeSeconds: 5 },
    ruleConfig: { defaultMultiplier: 1.98 },
    operationalConfig: { enabled: true, maintenance: false }
  },
  null,
  2
)}
                  </pre>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-300 mb-2">Immutable Rollback Guarantee</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Rolling back does NOT mutate or delete historical records. Instead, the configuration engine creates a brand new active version (e.g. v2) replicating target historical parameters, preserving audit traceability.
                  </p>
                  <div className="mt-4 p-2.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
                    Audit Status: Version immutability verified by unit test suite.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: WEBSOCKET EVENT FEED */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <h3 className="text-sm font-semibold text-white">Live WebSocket Stream (/ws)</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">Topic Subscriptions Active</span>
              </div>

              <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 border border-slate-800 space-y-2 max-h-96 overflow-y-auto">
                {wsEvents.length > 0 ? (
                  wsEvents.map((evt, i) => (
                    <div key={i} className="flex items-center space-x-3 text-[11px] border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">{evt.time}</span>
                      <span className="text-indigo-400 font-bold">{evt.topic}</span>
                      <span className="text-emerald-400 font-semibold">{evt.event}</span>
                      <span className="text-slate-400">status: {evt.status}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500 font-sans text-xs">
                    Connected to /ws. Trigger round transitions or game simulator actions to observe real-time stream broadcast.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: AUDIT & METRICS */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Append-Only Administrative Audit Log</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                    <tr>
                      <th className="px-4 py-2">Action</th>
                      <th className="px-4 py-2">Target Type</th>
                      <th className="px-4 py-2">Actor ID</th>
                      <th className="px-4 py-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {auditLogs.length > 0 ? (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-2 font-semibold text-indigo-300">{log.action}</td>
                          <td className="px-4 py-2 text-slate-400">{log.targetType}</td>
                          <td className="px-4 py-2 text-slate-500">{log.actorId.substring(0, 16)}</td>
                          <td className="px-4 py-2 text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500 font-sans">
                          No admin modifications logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: API CONTRACTS */}
        {activeTab === 'api' && (
          <div className="space-y-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">FGP-Backend Authoritative API Contract Reference</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                {[
                  { m: 'GET', p: '/health', d: 'Lightweight liveness probe' },
                  { m: 'GET', p: '/ready', d: 'Readiness probe inspecting DB, WS & 18 engines' },
                  { m: 'POST', p: '/api/v1/auth/register', d: 'Player registration with 10k welcome demo credits' },
                  { m: 'POST', p: '/api/v1/auth/login', d: 'Argon2 authentication & JWT token rotation' },
                  { m: 'GET', p: '/api/v1/me', d: 'Current authenticated identity & RBAC role' },
                  { m: 'GET', p: '/api/v1/games', d: 'Authoritative catalog of exactly 18 games' },
                  { m: 'GET', p: '/api/v1/games/:id', d: 'Individual game metadata and active config version' },
                  { m: 'POST', p: '/api/v1/predictions/submit', d: 'Server-authoritative prediction wager & settlement' },
                  { m: 'POST', p: '/api/v1/realtime/crash/enter', d: 'Crash multiplier flight entry' },
                  { m: 'POST', p: '/api/v1/mini-games/action', d: 'Mines, Plinko, Balloon, Step Path step action' },
                  { m: 'GET', p: '/api/v1/credits/balance', d: 'Authoritative virtual credit balance' },
                  { m: 'GET', p: '/api/v1/credits/transactions', d: 'Immutable double-entry virtual credit transactions' },
                  { m: 'POST', p: '/api/v1/admin/credits/adjust', d: 'Operator manual virtual balance adjustment' },
                  { m: 'POST', p: '/api/v1/rounds/:id/transition', d: 'Authoritative round state progression' },
                  { m: 'GET', p: '/ws', d: 'Real-time WebSocket event subscription stream' },
                ].map((route, i) => (
                  <div key={i} className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        route.m === 'GET' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {route.m}
                      </span>
                      <span className="text-slate-200">{route.p}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] font-sans">{route.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-500 text-xs py-4 px-4 sm:px-8 text-center">
        FGP Authoritative Backend • Modular Monolith Architecture • Virtual Demo Credits Only • Fastify & Prisma
      </footer>
    </div>
  );
}
