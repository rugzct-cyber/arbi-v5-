'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { ExitSpreadChart } from '@/components/ExitSpreadChart/ExitSpreadChart';
import styles from './positions.module.css';

interface Position {
    id: string;
    token: string;
    longExchange: string;
    shortExchange: string;
    entryPriceLong: number;
    entryPriceShort: number;
    tokenAmount: number;
    entrySpread: number;
    timestamp: number;
}

interface SpreadPoint {
    time: string;
    timestamp: number;
    exitSpread: number;
    longBid: number;
    shortAsk: number;
}

const EXCHANGES = ['paradex', 'vest', 'extended', 'hyperliquid', 'lighter', 'pacifica', 'ethereal'];

const REFRESH_OPTIONS = [
    { label: 'Instant', value: 0 },
    { label: '5s', value: 5000 },
    { label: '15s', value: 15000 },
    { label: '30s', value: 30000 },
    { label: '1min', value: 60000 },
];

export default function PositionsPage() {
    const { prices, isConnected, exchanges, lastRefresh, refreshPrices, refreshInterval, setRefreshInterval } = useSocket();

    // Form state
    const [token, setToken] = useState('');
    const [longExchange, setLongExchange] = useState('');
    const [shortExchange, setShortExchange] = useState('');
    const [entryPriceLong, setEntryPriceLong] = useState('');
    const [entryPriceShort, setEntryPriceShort] = useState('');
    const [tokenAmount, setTokenAmount] = useState('');

    // Positions state
    const [positions, setPositions] = useState<Position[]>([]);
    const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Spread history for chart
    const [spreadHistory, setSpreadHistory] = useState<SpreadPoint[]>([]);

    // Load positions from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('positions');
        if (saved) {
            try {
                setPositions(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse saved positions:', e);
            }
        }
        setIsInitialized(true);
    }, []);

    // Save positions to localStorage (only after initial load)
    useEffect(() => {
        if (isInitialized) {
            localStorage.setItem('positions', JSON.stringify(positions));
        }
    }, [positions, isInitialized]);

    // Calculate exit spread for selected position
    const exitSpreadData = useMemo(() => {
        if (!selectedPosition) return null;

        const tokenPrices = prices.get(selectedPosition.token);
        if (!tokenPrices) return null;

        const longPrice = tokenPrices.get(selectedPosition.longExchange);
        const shortPrice = tokenPrices.get(selectedPosition.shortExchange);

        if (!longPrice || !shortPrice) return null;

        // Entry spread in $ (what we made at entry)
        const entrySpreadDollar = selectedPosition.entryPriceShort - selectedPosition.entryPriceLong;

        // To close position:
        // - Sell the LONG position → receive BID price
        // - Buy back the SHORT position → pay ASK price
        // Exit spread $ = longBid - shortAsk
        const exitSpreadDollar = longPrice.bid - shortPrice.ask;

        // Exit spread % = (longBid - shortAsk) / shortAsk * 100
        const exitSpread = shortPrice.ask > 0
            ? ((longPrice.bid - shortPrice.ask) / shortPrice.ask * 100)
            : 0;

        // Break-even: We're at break-even when exitSpreadDollar = -entrySpreadDollar
        // We're in profit when: exitSpreadDollar >= -entrySpreadDollar
        // Which is equivalent to: exitSpreadDollar + entrySpreadDollar >= 0
        const breakEvenExitSpread = -entrySpreadDollar;
        const isInProfit = exitSpreadDollar >= breakEvenExitSpread;

        // Current closing price (what we get if we exit now)
        const currentPrice = longPrice.bid;

        // PnL calculation
        const longPnl = selectedPosition.entryPriceLong > 0
            ? ((longPrice.bid - selectedPosition.entryPriceLong) / selectedPosition.entryPriceLong * 100)
            : 0;
        const shortPnl = selectedPosition.entryPriceShort > 0
            ? ((selectedPosition.entryPriceShort - shortPrice.ask) / selectedPosition.entryPriceShort * 100)
            : 0;
        const pnl = longPnl + shortPnl;

        return {
            longBid: longPrice.bid,
            longAsk: longPrice.ask,
            shortBid: shortPrice.bid,
            shortAsk: shortPrice.ask,
            exitSpread: Math.round(exitSpread * 10000) / 10000,
            exitSpreadDollar,
            breakEvenExitSpread,
            isInProfit,
            currentPrice,
            pnl: Math.round(pnl * 10000) / 10000,
        };
    }, [selectedPosition, prices]);

    // Update spread history for chart - KEEP ALL HISTORY
    useEffect(() => {
        if (exitSpreadData && selectedPosition) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            setSpreadHistory(prev => {
                // Keep ALL history, no limit
                return [...prev, {
                    time: timeStr,
                    timestamp: Date.now(),
                    exitSpread: exitSpreadData.exitSpread,
                    longBid: exitSpreadData.longBid,
                    shortAsk: exitSpreadData.shortAsk
                }];
            });
        }
    }, [exitSpreadData, selectedPosition]);

    // Add new position
    const handleAddPosition = () => {
        if (!token || !longExchange || !shortExchange || !entryPriceLong || !entryPriceShort || !tokenAmount) {
            alert('Remplis tous les champs');
            return;
        }

        const newPosition: Position = {
            id: Date.now().toString(),
            token: token.toUpperCase().includes('-USD') ? token.toUpperCase() : `${token.toUpperCase()}-USD`,
            longExchange,
            shortExchange,
            entryPriceLong: parseFloat(entryPriceLong),
            entryPriceShort: parseFloat(entryPriceShort),
            tokenAmount: parseFloat(tokenAmount),
            entrySpread: 0,
            timestamp: Date.now(),
        };

        setPositions(prev => [...prev, newPosition]);
        setToken('');
        setLongExchange('');
        setShortExchange('');
        setEntryPriceLong('');
        setEntryPriceShort('');
        setTokenAmount('');
    };

    // Delete position
    const handleDeletePosition = (id: string) => {
        setPositions(prev => prev.filter(p => p.id !== id));
        if (selectedPosition?.id === id) {
            setSelectedPosition(null);
            setSpreadHistory([]);
        }
    };

    // Select position for monitoring
    const handleSelectPosition = (position: Position) => {
        setSelectedPosition(position);
        setSpreadHistory([]);
    };

    return (
        <div className={styles.container}>
            {/* Header - Same as Dashboard */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <h1 className={styles.title}>
                        <span className={styles.logo}>📊</span>
                        Position Manager
                    </h1>

                    <nav className={styles.nav}>
                        <a href="/" className={styles.navLinkInactive}>Dashboard</a>
                        <a href="/positions" className={styles.navLink}>Positions</a>
                    </nav>

                    <div className={styles.headerRight}>
                        <div className={styles.refreshSection}>
                            <select
                                className={styles.refreshSelect}
                                value={refreshInterval}
                                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                            >
                                {REFRESH_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <span className={styles.lastRefresh} suppressHydrationWarning>
                                Updated: {lastRefresh.toLocaleTimeString()}
                            </span>
                            <button className={styles.refreshBtn} onClick={refreshPrices}>
                                Refresh
                            </button>
                        </div>

                        <div className={styles.status}>
                            <span className={`${styles.statusDot} ${isConnected ? styles.connected : styles.disconnected}`} />
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </div>
                    </div>
                </div>
            </header>

            <div className={styles.content}>
                {/* Left: Position List & Form */}
                <div className={styles.sidebar}>
                    {/* Add Position Form */}
                    <div className={styles.formCard}>
                        <h2>Nouvelle Position</h2>
                        <div className={styles.formGroup}>
                            <label>Token</label>
                            <input
                                type="text"
                                placeholder="BTC, ETH, SOL..."
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Exchange LONG</label>
                            <select value={longExchange} onChange={(e) => setLongExchange(e.target.value)}>
                                <option value="">Sélectionner...</option>
                                {EXCHANGES.map(ex => (
                                    <option key={ex} value={ex}>{ex.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Exchange SHORT</label>
                            <select value={shortExchange} onChange={(e) => setShortExchange(e.target.value)}>
                                <option value="">Sélectionner...</option>
                                {EXCHANGES.map(ex => (
                                    <option key={ex} value={ex}>{ex.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Prix d'entrée LONG ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="100.00"
                                value={entryPriceLong}
                                onChange={(e) => setEntryPriceLong(e.target.value)}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Prix d'entrée SHORT ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="100.00"
                                value={entryPriceShort}
                                onChange={(e) => setEntryPriceShort(e.target.value)}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Nombre de tokens</label>
                            <input
                                type="number"
                                step="0.0001"
                                placeholder="1.5"
                                value={tokenAmount}
                                onChange={(e) => setTokenAmount(e.target.value)}
                            />
                        </div>
                        <button className={styles.addBtn} onClick={handleAddPosition}>
                            + Ajouter Position
                        </button>
                    </div>

                    {/* Position List */}
                    <div className={styles.positionList}>
                        <h2>Positions Ouvertes ({positions.length})</h2>
                        {positions.length === 0 ? (
                            <p className={styles.emptyText}>Aucune position</p>
                        ) : (
                            positions.map(pos => (
                                <div
                                    key={pos.id}
                                    className={`${styles.positionCard} ${selectedPosition?.id === pos.id ? styles.selected : ''}`}
                                    onClick={() => handleSelectPosition(pos)}
                                >
                                    <div className={styles.positionHeader}>
                                        <span className={styles.tokenName}>{pos.token.replace('-USD', '')}</span>
                                        <button
                                            className={styles.deleteBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeletePosition(pos.id);
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div className={styles.positionDetails}>
                                        <span>LONG {pos.longExchange.toUpperCase()}</span>
                                        <span>SHORT {pos.shortExchange.toUpperCase()}</span>
                                    </div>
                                    <div className={styles.entrySpread}>
                                        Long: ${pos.entryPriceLong.toFixed(2)} | Short: ${pos.entryPriceShort.toFixed(2)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right: Exit Spread Monitor */}
                <div className={styles.mainPanel}>
                    {selectedPosition ? (
                        <>
                            <div className={styles.monitorHeader}>
                                <h2>{selectedPosition.token.replace('-USD', '')}</h2>
                                <span className={styles.strategy}>
                                    LONG {selectedPosition.longExchange.toUpperCase()} /
                                    SHORT {selectedPosition.shortExchange.toUpperCase()}
                                </span>
                            </div>

                            {/* Stats Cards - Row 1 */}
                            <div className={styles.statsGrid}>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>TOKENS</span>
                                    <span className={styles.statValue}>{selectedPosition.tokenAmount}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>ENTRÉE LONG</span>
                                    <span className={styles.statValue}>${selectedPosition.entryPriceLong.toFixed(2)}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>ENTRÉE SHORT</span>
                                    <span className={styles.statValue}>${selectedPosition.entryPriceShort.toFixed(2)}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>SPREAD ENTRÉE</span>
                                    <span className={`${styles.statValue} ${(selectedPosition.entryPriceShort - selectedPosition.entryPriceLong) > 0 ? styles.positive : styles.negative}`}>
                                        ${(selectedPosition.entryPriceShort - selectedPosition.entryPriceLong).toFixed(2)} ({((selectedPosition.entryPriceShort - selectedPosition.entryPriceLong) / selectedPosition.entryPriceLong * 100).toFixed(4)}%)
                                    </span>
                                </div>
                            </div>
                            {/* Stats Cards - Row 2 */}
                            <div className={styles.statsGrid}>
                                <div className={styles.statCardEmpty}></div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>BID ACTUEL (LONG)</span>
                                    <span className={styles.statValue}>${exitSpreadData?.longBid.toFixed(2) || '-'}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>ASK ACTUEL (SHORT)</span>
                                    <span className={styles.statValue}>${exitSpreadData?.shortAsk.toFixed(2) || '-'}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>SPREAD SORTIE</span>
                                    <span className={`${styles.statValue} ${exitSpreadData?.isInProfit ? styles.positive : styles.negative}`}>
                                        ${exitSpreadData ? (exitSpreadData.longBid - exitSpreadData.shortAsk).toFixed(2) : '-'} ({exitSpreadData?.exitSpread.toFixed(4) || '-'}%)
                                    </span>
                                </div>
                            </div>
                            {/* Stats Cards - Row 3: Only SPREAD $ (TOTAL) in 4th column */}
                            <div className={styles.statsGrid}>
                                <div className={styles.statCardEmpty}></div>
                                <div className={styles.statCardEmpty}></div>
                                <div className={styles.statCardEmpty}></div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>P&L $ (TOTAL)</span>
                                    <span className={`${styles.statValue} ${exitSpreadData?.isInProfit ? styles.positive : styles.negative}`}>
                                        ${exitSpreadData && selectedPosition.tokenAmount
                                            ? (((selectedPosition.entryPriceShort - selectedPosition.entryPriceLong) + (exitSpreadData.longBid - exitSpreadData.shortAsk)) * selectedPosition.tokenAmount).toFixed(2)
                                            : '-'}
                                    </span>
                                </div>
                            </div>

                            {/* Price Details */}
                            <div className={styles.priceDetails}>
                                <div className={styles.exchangePrice}>
                                    <span className={styles.exchangeName}>{selectedPosition.longExchange.toUpperCase()} (LONG)</span>
                                    <div className={styles.prices}>
                                        <span>Bid: ${exitSpreadData?.longBid.toFixed(4) || '-'}</span>
                                        <span>Ask: ${exitSpreadData?.longAsk.toFixed(4) || '-'}</span>
                                    </div>
                                </div>
                                <div className={styles.exchangePrice}>
                                    <span className={styles.exchangeName}>{selectedPosition.shortExchange.toUpperCase()} (SHORT)</span>
                                    <div className={styles.prices}>
                                        <span>Bid: ${exitSpreadData?.shortBid.toFixed(4) || '-'}</span>
                                        <span>Ask: ${exitSpreadData?.shortAsk.toFixed(4) || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Exit Spread Chart - Historical Data from DB */}
                            <ExitSpreadChart
                                symbol={selectedPosition.token}
                                longExchange={selectedPosition.longExchange}
                                shortExchange={selectedPosition.shortExchange}
                                currentExitSpread={exitSpreadData?.exitSpread || 0}
                                entryPriceLong={selectedPosition.entryPriceLong}
                                entryPriceShort={selectedPosition.entryPriceShort}
                            />
                        </>
                    ) : (
                        <div className={styles.emptyState}>
                            <h2>👈 Sélectionne une position</h2>
                            <p>Clique sur une position à gauche pour voir le spread de sortie en temps réel</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
