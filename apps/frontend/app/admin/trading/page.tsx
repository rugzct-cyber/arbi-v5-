'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import styles from './trading.module.css';

// Available exchanges
const ALL_EXCHANGES = ['hyperliquid', 'paradex', 'vest', 'extended', 'lighter', 'pacifica', 'ethereal', 'nado'];
const LEVERAGE_OPTIONS = [1, 2, 5, 10, 20];

// Engine Socket.io URL
const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || 'https://arbi-v5--production.up.railway.app';

interface TradingStats {
    isRunning: boolean;
    isAuthenticated: boolean;
    strategy: {
        opportunitiesSeen: number;
        opportunitiesFiltered: number;
        tradesAttempted: number;
        tradesSucceeded: number;
        tradesFailed: number;
    };
    activeTrades: ActiveTrade[];
    tradeHistory: TradeRecord[];
}

interface ActiveTrade {
    id: string;
    symbol: string;
    longExchange: string;
    shortExchange: string;
    entrySpread: number;
    currentSpread?: number;
    entryPriceLong?: number;
    entryPriceShort?: number;
    positionSize?: number;
    pnl: number;
    openedAt?: string;
}

interface TradeRecord {
    id: string;
    symbol: string;
    longExchange: string;
    shortExchange: string;
    entrySpread: number;
    exitSpread: number;
    pnl: number;
    duration?: string;
    status: 'COMPLETED' | 'FAILED' | 'LIQUIDATED';
    closedAt?: string;
}

interface BotConfig {
    paperMode: boolean;
    minSpreadPercent: number;
    maxSpreadPercent: number;
    positionSizePerLeg: number;
    leverage: number;
    verifyWithRest: boolean;
    antiLiquidation: boolean;
    selectedExchanges: string[];
    allowedTokens: string[];
}

// Loading fallback
function LoadingFallback() {
    return (
        <div className={styles.container}>
            <div className={styles.accessDenied}>
                <div className={styles.spinner}></div>
                <p>Chargement...</p>
            </div>
        </div>
    );
}

export default function TradingAdminPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <TradingAdminContent />
        </Suspense>
    );
}

function TradingAdminContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [stats, setStats] = useState<TradingStats | null>(null);
    const [tokenInput, setTokenInput] = useState('');
    const [config, setConfig] = useState<BotConfig>({
        paperMode: true,
        minSpreadPercent: 0.2,
        maxSpreadPercent: 5.0,
        positionSizePerLeg: 100,
        leverage: 5,
        verifyWithRest: true,
        antiLiquidation: true,
        selectedExchanges: ['hyperliquid', 'paradex'],
        allowedTokens: [],
    });

    const socketRef = useRef<Socket | null>(null);

    // Calculate collateral
    const estimatedCollateral = (config.positionSizePerLeg * 2) / config.leverage;
    const liquidationBuffer = config.antiLiquidation ? ' (protection active)' : '';

    // Verify token with local API first
    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setError('Token manquant');
                setIsLoading(false);
                return;
            }
            try {
                const response = await fetch(`/api/trading/auth?token=${token}`);
                if (response.ok) {
                    setIsAuthenticated(true);
                } else {
                    setError('Token invalide');
                }
            } catch {
                setError('Erreur réseau');
            }
            setIsLoading(false);
        };
        verifyToken();
    }, [token]);

    // Connect to engine Socket.io
    useEffect(() => {
        if (!isAuthenticated || !token) return;

        console.log('[Trading] Connecting to engine:', ENGINE_URL);
        const socket = io(ENGINE_URL, {
            transports: ['websocket', 'polling'],
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[Trading] Connected to engine');
            setConnected(true);
            // Request current stats
            socket.emit('trading:stats');
        });

        socket.on('disconnect', () => {
            console.log('[Trading] Disconnected from engine');
            setConnected(false);
        });

        socket.on('trading:update', (data: TradingStats) => {
            console.log('[Trading] Stats update:', data);
            setStats(data);
        });

        socket.on('trading:error', (message: string) => {
            console.error('[Trading] Error:', message);
            setError(message);
        });

        return () => {
            socket.disconnect();
        };
    }, [isAuthenticated, token]);

    // Bot controls via Socket.io
    const startBot = () => {
        if (socketRef.current && token) {
            console.log('[Trading] Sending start command');
            socketRef.current.emit('trading:start', token);
        }
    };

    const stopBot = () => {
        if (socketRef.current) {
            console.log('[Trading] Sending stop command');
            socketRef.current.emit('trading:stop');
        }
    };

    const updateConfig = () => {
        if (socketRef.current) {
            console.log('[Trading] Sending config update');
            socketRef.current.emit('trading:config', {
                paperMode: config.paperMode,
                minSpreadPercent: config.minSpreadPercent,
                maxSpreadPercent: config.maxSpreadPercent,
                maxPositionSizeUsd: config.positionSizePerLeg,
                verifyWithRest: config.verifyWithRest,
            });
        }
    };

    // Loading/Error states
    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.accessDenied}>
                    <div className={styles.spinner}></div>
                    <p>Vérification...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated || error) {
        return (
            <div className={styles.container}>
                <div className={styles.accessDenied}>
                    <div className={styles.lockIcon}>🔒</div>
                    <h1>Accès Refusé</h1>
                    <p>{error || 'Token requis'}</p>
                </div>
            </div>
        );
    }

    // Calculate performance from stats
    const totalTrades = (stats?.strategy?.tradesSucceeded || 0) + (stats?.strategy?.tradesFailed || 0);
    const winRate = totalTrades > 0 ? ((stats?.strategy?.tradesSucceeded || 0) / totalTrades) * 100 : 0;

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1>🤖 Trading Bot</h1>
                    <span className={stats?.isRunning ? styles.statusActive : styles.statusInactive}>
                        {stats?.isRunning ? '● RUNNING' : '○ STOPPED'}
                    </span>
                    {config.paperMode && <span className={styles.paperBadge}>PAPER</span>}
                    <span className={connected ? styles.statusActive : styles.statusInactive}>
                        {connected ? '🟢 Engine' : '🔴 Offline'}
                    </span>
                </div>
                <div className={styles.headerControls}>
                    <button className={styles.startBtn} onClick={startBot} disabled={stats?.isRunning || !connected}>
                        ▶ Start
                    </button>
                    <button className={styles.stopBtn} onClick={stopBot} disabled={!stats?.isRunning || !connected}>
                        ⏹ Stop
                    </button>
                </div>
            </header>

            {/* Performance Dashboard */}
            <section className={styles.performanceBar}>
                <div className={styles.perfItem}>
                    <span className={styles.perfValue}>{stats?.strategy?.opportunitiesSeen || 0}</span>
                    <span className={styles.perfLabel}>Opportunités</span>
                </div>
                <div className={styles.perfItem}>
                    <span className={styles.perfValue}>{stats?.strategy?.tradesAttempted || 0}</span>
                    <span className={styles.perfLabel}>Tentatives</span>
                </div>
                <div className={styles.perfItem}>
                    <span className={styles.perfValue} style={{ color: '#4ade80' }}>
                        {stats?.strategy?.tradesSucceeded || 0}
                    </span>
                    <span className={styles.perfLabel}>Réussis</span>
                </div>
                <div className={styles.perfItem}>
                    <span className={styles.perfValue} style={{ color: '#f87171' }}>
                        {stats?.strategy?.tradesFailed || 0}
                    </span>
                    <span className={styles.perfLabel}>Échoués</span>
                </div>
                <div className={styles.perfItem}>
                    <span className={styles.perfValue}>{winRate.toFixed(1)}%</span>
                    <span className={styles.perfLabel}>Win Rate</span>
                </div>
            </section>

            <div className={styles.mainGrid}>
                {/* Left Column - Config */}
                <div className={styles.leftColumn}>
                    {/* Configuration */}
                    <section className={styles.panel}>
                        <h2>⚙️ Configuration</h2>
                        <div className={styles.configGrid}>
                            <label className={styles.configItem}>
                                <span>Paper Mode</span>
                                <input
                                    type="checkbox"
                                    checked={config.paperMode}
                                    onChange={(e) => setConfig({ ...config, paperMode: e.target.checked })}
                                />
                            </label>
                            <label className={styles.configItem}>
                                <span>Vérification REST</span>
                                <input
                                    type="checkbox"
                                    checked={config.verifyWithRest}
                                    onChange={(e) => setConfig({ ...config, verifyWithRest: e.target.checked })}
                                />
                            </label>
                            <label className={styles.configItem}>
                                <span>Anti-Liquidation</span>
                                <input
                                    type="checkbox"
                                    checked={config.antiLiquidation}
                                    onChange={(e) => setConfig({ ...config, antiLiquidation: e.target.checked })}
                                />
                            </label>
                            <label className={styles.configItem}>
                                <span>Spread Min (%)</span>
                                <input
                                    type="number"
                                    step="0.05"
                                    value={config.minSpreadPercent}
                                    onChange={(e) => setConfig({ ...config, minSpreadPercent: parseFloat(e.target.value) || 0 })}
                                />
                            </label>
                            <label className={styles.configItem}>
                                <span>Spread Max (%)</span>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={config.maxSpreadPercent}
                                    onChange={(e) => setConfig({ ...config, maxSpreadPercent: parseFloat(e.target.value) || 0 })}
                                />
                            </label>
                            <label className={styles.configItem}>
                                <span>Taille/Jambe ($)</span>
                                <input
                                    type="number"
                                    step="50"
                                    value={config.positionSizePerLeg}
                                    onChange={(e) => setConfig({ ...config, positionSizePerLeg: parseFloat(e.target.value) || 0 })}
                                />
                            </label>
                            <label className={styles.configItem}>
                                <span>Levier</span>
                                <select
                                    value={config.leverage}
                                    onChange={(e) => setConfig({ ...config, leverage: parseInt(e.target.value) })}
                                >
                                    {LEVERAGE_OPTIONS.map((lev) => (
                                        <option key={lev} value={lev}>{lev}x</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className={styles.collateralInfo}>
                            💰 Collateral estimé: <strong>${estimatedCollateral.toFixed(2)}</strong>
                            {liquidationBuffer}
                        </div>
                        <button className={styles.updateBtn} onClick={updateConfig} disabled={!connected}>
                            Sauvegarder
                        </button>
                    </section>

                    {/* Exchanges */}
                    <section className={styles.panel}>
                        <h2>📡 Exchanges ({config.selectedExchanges.length})</h2>
                        <div className={styles.exchangeGrid}>
                            {ALL_EXCHANGES.map((ex) => (
                                <label key={ex} className={styles.exchangeChip} data-active={config.selectedExchanges.includes(ex)}>
                                    <input
                                        type="checkbox"
                                        checked={config.selectedExchanges.includes(ex)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setConfig({ ...config, selectedExchanges: [...config.selectedExchanges, ex] });
                                            } else {
                                                setConfig({ ...config, selectedExchanges: config.selectedExchanges.filter(x => x !== ex) });
                                            }
                                        }}
                                    />
                                    {ex.toUpperCase()}
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Tokens */}
                    <section className={styles.panel}>
                        <h2>🪙 Tokens ({config.allowedTokens.length || 'Tous'})</h2>
                        <div className={styles.tokenInput}>
                            <input
                                type="text"
                                placeholder="BTC-USD, ETH-USD..."
                                value={tokenInput}
                                onChange={(e) => setTokenInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && tokenInput.trim()) {
                                        const newToken = tokenInput.trim().toUpperCase();
                                        if (!config.allowedTokens.includes(newToken)) {
                                            setConfig({ ...config, allowedTokens: [...config.allowedTokens, newToken] });
                                        }
                                        setTokenInput('');
                                    }
                                }}
                            />
                            <button onClick={() => {
                                if (tokenInput.trim()) {
                                    const newToken = tokenInput.trim().toUpperCase();
                                    if (!config.allowedTokens.includes(newToken)) {
                                        setConfig({ ...config, allowedTokens: [...config.allowedTokens, newToken] });
                                    }
                                    setTokenInput('');
                                }
                            }}>+</button>
                        </div>
                        <div className={styles.tokenList}>
                            {config.allowedTokens.length === 0 ? (
                                <span className={styles.allTokens}>Tous les tokens autorisés</span>
                            ) : (
                                config.allowedTokens.map((t) => (
                                    <span key={t} className={styles.tokenChip}>
                                        {t}
                                        <button onClick={() => setConfig({
                                            ...config,
                                            allowedTokens: config.allowedTokens.filter(x => x !== t)
                                        })}>×</button>
                                    </span>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                {/* Right Column - Trades */}
                <div className={styles.rightColumn}>
                    {/* Active Trades */}
                    <section className={styles.panel}>
                        <h2>🔥 Trades Actifs ({stats?.activeTrades?.length || 0})</h2>
                        {stats?.activeTrades && stats.activeTrades.length > 0 ? (
                            <div className={styles.tradesTable}>
                                <div className={styles.tableHeader}>
                                    <span>Token</span>
                                    <span>Long → Short</span>
                                    <span>Entry</span>
                                    <span>PnL</span>
                                </div>
                                {stats.activeTrades.map((trade) => (
                                    <div key={trade.id} className={styles.tableRow}>
                                        <span className={styles.tradeSymbol}>{trade.symbol.replace('-USD', '')}</span>
                                        <span className={styles.tradeExchanges}>
                                            {trade.longExchange} → {trade.shortExchange}
                                        </span>
                                        <span>{trade.entrySpread?.toFixed(3)}%</span>
                                        <span className={styles.tradePnl} data-positive={(trade.pnl ?? 0) >= 0}>
                                            {(trade.pnl ?? 0) >= 0 ? '+' : ''}{(trade.pnl ?? 0).toFixed(2)}$
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className={styles.emptyState}>Aucun trade actif</p>
                        )}
                    </section>

                    {/* Trade History */}
                    <section className={styles.panel}>
                        <h2>📜 Historique</h2>
                        {stats?.tradeHistory && stats.tradeHistory.length > 0 ? (
                            <div className={styles.tradesTable}>
                                <div className={styles.tableHeader}>
                                    <span>Token</span>
                                    <span>Exchanges</span>
                                    <span>Entry → Exit</span>
                                    <span>PnL</span>
                                </div>
                                {stats.tradeHistory.slice(0, 10).map((trade) => (
                                    <div key={trade.id} className={styles.tableRow}>
                                        <span className={styles.tradeSymbol}>{trade.symbol.replace('-USD', '')}</span>
                                        <span className={styles.tradeExchanges}>
                                            {trade.longExchange} / {trade.shortExchange}
                                        </span>
                                        <span>{trade.entrySpread?.toFixed(2)}% → {trade.exitSpread?.toFixed(2)}%</span>
                                        <span className={styles.tradePnl} data-positive={(trade.pnl ?? 0) >= 0}>
                                            {(trade.pnl ?? 0) >= 0 ? '+' : ''}{(trade.pnl ?? 0).toFixed(2)}$
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className={styles.emptyState}>Aucun historique</p>
                        )}
                    </section>
                </div>
            </div>

            {/* Footer Warning */}
            <footer className={styles.footer}>
                ⚠️ Page secrète - Ne partagez jamais l'URL
            </footer>
        </div>
    );
}
