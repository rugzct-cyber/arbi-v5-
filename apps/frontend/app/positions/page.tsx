'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { ExitSpreadChart } from '@/components/ExitSpreadChart/ExitSpreadChart';
import { Header } from '@/components/Header';
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
    // Alarm fields
    alarmEnabled?: boolean;
    alarmThreshold?: number; // Exit spread threshold in %
    alarmTriggered?: boolean;
}

interface SpreadPoint {
    time: string;
    timestamp: number;
    exitSpread: number;
    longBid: number;
    shortAsk: number;
}

const EXCHANGES = ['paradex', 'vest', 'extended', 'hyperliquid', 'lighter', 'pacifica', 'ethereal', 'nado'];

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

    // Editing state for position values
    const [editingField, setEditingField] = useState<'entryPriceLong' | 'entryPriceShort' | 'tokenAmount' | null>(null);
    const [editValue, setEditValue] = useState('');

    // Spread history for chart
    const [spreadHistory, setSpreadHistory] = useState<SpreadPoint[]>([]);

    // Alarm state
    const [alarmThresholdInput, setAlarmThresholdInput] = useState('');
    const [showAlarmConfig, setShowAlarmConfig] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

    // Play profit alarm sound - LOUD with repetitions
    const playAlarmSound = useCallback(() => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioContextRef.current;

            // Play the alarm pattern 3 times for emphasis
            const playPattern = (delay: number) => {
                const notes = [523, 659, 784, 1046]; // C5, E5, G5, C6 - major chord + octave
                notes.forEach((freq, i) => {
                    setTimeout(() => {
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.frequency.value = freq;
                        osc.type = 'square'; // More aggressive sound
                        gain.gain.setValueAtTime(0.6, ctx.currentTime); // Louder!
                        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                        osc.start(ctx.currentTime);
                        osc.stop(ctx.currentTime + 0.3);
                    }, delay + i * 100);
                });
            };

            // 3 repetitions with gaps
            playPattern(0);
            playPattern(600);
            playPattern(1200);
        } catch (e) {
            console.log('Audio not available:', e);
        }
    }, []);

    // Calculate current P&L
    const currentPnL = useMemo(() => {
        if (!exitSpreadData || !selectedPosition) return null;
        return ((selectedPosition.entryPriceShort - selectedPosition.entryPriceLong) +
            (exitSpreadData.longBid - exitSpreadData.shortAsk)) * selectedPosition.tokenAmount;
    }, [exitSpreadData, selectedPosition]);

    // Check alarm trigger - based on exit spread %
    useEffect(() => {
        if (!selectedPosition || !exitSpreadData) return;
        if (!selectedPosition.alarmEnabled || selectedPosition.alarmTriggered) return;
        if (selectedPosition.alarmThreshold === undefined) return;

        // Trigger when exit spread reaches or exceeds threshold
        if (exitSpreadData.exitSpread >= selectedPosition.alarmThreshold) {
            // Trigger alarm!
            playAlarmSound();

            // Mark as triggered
            setPositions(prev => prev.map(p =>
                p.id === selectedPosition.id ? { ...p, alarmTriggered: true } : p
            ));
            setSelectedPosition(prev => prev ? { ...prev, alarmTriggered: true } : null);

            // Repeat sound every 10 seconds
            soundIntervalRef.current = setInterval(playAlarmSound, 10000);
        }

        return () => {
            if (soundIntervalRef.current) {
                clearInterval(soundIntervalRef.current);
            }
        };
    }, [exitSpreadData, selectedPosition, playAlarmSound]);

    // Toggle alarm on/off
    const handleToggleAlarm = () => {
        if (!selectedPosition) return;

        if (selectedPosition.alarmEnabled) {
            // Disable alarm
            if (soundIntervalRef.current) {
                clearInterval(soundIntervalRef.current);
                soundIntervalRef.current = null;
            }
            setPositions(prev => prev.map(p =>
                p.id === selectedPosition.id ? { ...p, alarmEnabled: false, alarmTriggered: false } : p
            ));
            setSelectedPosition(prev => prev ? { ...prev, alarmEnabled: false, alarmTriggered: false } : null);
        } else {
            // Show config to enable
            setShowAlarmConfig(true);
            setAlarmThresholdInput(selectedPosition.alarmThreshold?.toString() || '');
        }
    };

    // Save alarm config
    const handleSaveAlarm = () => {
        if (!selectedPosition) return;
        const threshold = parseFloat(alarmThresholdInput);
        if (isNaN(threshold)) {
            setShowAlarmConfig(false);
            return;
        }

        setPositions(prev => prev.map(p =>
            p.id === selectedPosition.id ? { ...p, alarmEnabled: true, alarmThreshold: threshold, alarmTriggered: false } : p
        ));
        setSelectedPosition(prev => prev ? { ...prev, alarmEnabled: true, alarmThreshold: threshold, alarmTriggered: false } : null);
        setShowAlarmConfig(false);
    };

    // Dismiss triggered alarm
    const handleDismissAlarm = () => {
        if (!selectedPosition) return;
        if (soundIntervalRef.current) {
            clearInterval(soundIntervalRef.current);
            soundIntervalRef.current = null;
        }
        setPositions(prev => prev.map(p =>
            p.id === selectedPosition.id ? { ...p, alarmEnabled: false, alarmTriggered: false } : p
        ));
        setSelectedPosition(prev => prev ? { ...prev, alarmEnabled: false, alarmTriggered: false } : null);
    };

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
        setEditingField(null);
    };

    // Start editing a field
    const handleStartEdit = (field: 'entryPriceLong' | 'entryPriceShort' | 'tokenAmount') => {
        if (!selectedPosition) return;
        setEditingField(field);
        setEditValue(selectedPosition[field].toString());
    };

    // Save edited value
    const handleSaveEdit = () => {
        if (!selectedPosition || !editingField) return;

        const newValue = parseFloat(editValue);
        if (isNaN(newValue) || newValue <= 0) {
            setEditingField(null);
            return;
        }

        const updatedPosition = { ...selectedPosition, [editingField]: newValue };
        setPositions(prev => prev.map(p => p.id === selectedPosition.id ? updatedPosition : p));
        setSelectedPosition(updatedPosition);
        setEditingField(null);
    };

    // Cancel editing
    const handleCancelEdit = () => {
        setEditingField(null);
        setEditValue('');
    };

    // Handle key press in edit mode
    const handleEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <Header
                activePage="positions"
                isConnected={isConnected}
                refreshOptions={{
                    refreshInterval,
                    onRefreshIntervalChange: setRefreshInterval,
                    lastRefresh,
                    onRefresh: refreshPrices
                }}
            />

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
                                <div
                                    className={`${styles.statCard} ${styles.statCardEditable}`}
                                    onClick={() => handleStartEdit('entryPriceLong')}
                                    title="Cliquer pour modifier"
                                >
                                    <span className={styles.statLabel}>ENTRÉE LONG</span>
                                    {editingField === 'entryPriceLong' ? (
                                        <input
                                            type="number"
                                            step="0.01"
                                            className={styles.statInput}
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleSaveEdit}
                                            onKeyDown={handleEditKeyDown}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className={styles.statValue}>${selectedPosition.entryPriceLong.toFixed(2)}</span>
                                    )}
                                </div>
                                <div
                                    className={`${styles.statCard} ${styles.statCardEditable}`}
                                    onClick={() => handleStartEdit('entryPriceShort')}
                                    title="Cliquer pour modifier"
                                >
                                    <span className={styles.statLabel}>ENTRÉE SHORT</span>
                                    {editingField === 'entryPriceShort' ? (
                                        <input
                                            type="number"
                                            step="0.01"
                                            className={styles.statInput}
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleSaveEdit}
                                            onKeyDown={handleEditKeyDown}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className={styles.statValue}>${selectedPosition.entryPriceShort.toFixed(2)}</span>
                                    )}
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>SPREAD ENTRÉE</span>
                                    <span className={`${styles.statValue} ${(selectedPosition.entryPriceShort - selectedPosition.entryPriceLong) > 0 ? styles.positive : styles.negative}`}>
                                        ${(selectedPosition.entryPriceShort - selectedPosition.entryPriceLong).toFixed(2)} ({((selectedPosition.entryPriceShort - selectedPosition.entryPriceLong) / selectedPosition.entryPriceLong * 100).toFixed(4)}%)
                                    </span>
                                </div>
                                <div
                                    className={`${styles.statCard} ${styles.statCardEditable}`}
                                    onClick={() => handleStartEdit('tokenAmount')}
                                    title="Cliquer pour modifier"
                                >
                                    <span className={styles.statLabel}>TOKENS</span>
                                    {editingField === 'tokenAmount' ? (
                                        <input
                                            type="number"
                                            step="0.0001"
                                            className={styles.statInput}
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleSaveEdit}
                                            onKeyDown={handleEditKeyDown}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className={styles.statValue}>{selectedPosition.tokenAmount}</span>
                                    )}
                                </div>
                            </div>
                            {/* Stats Cards - Row 2 */}
                            <div className={styles.statsGrid}>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>BID ACTUEL (LONG)</span>
                                    <span className={styles.statValue}>${exitSpreadData?.longBid.toFixed(2) || '-'}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>ASK ACTUEL (SHORT)</span>
                                    <span className={styles.statValue}>${exitSpreadData?.shortAsk.toFixed(2) || '-'}</span>
                                </div>
                                <div className={`${styles.statCard} ${selectedPosition.alarmTriggered ? styles.alarmTriggered : ''}`}>
                                    <div className={styles.statHeader}>
                                        <span className={styles.statLabel}>SPREAD SORTIE</span>
                                        <button
                                            className={`${styles.alarmButton} ${selectedPosition.alarmEnabled ? styles.alarmActive : ''}`}
                                            onClick={handleToggleAlarm}
                                            title={selectedPosition.alarmEnabled ? 'Désactiver alarme' : 'Activer alarme sortie'}
                                        >
                                            🔔
                                        </button>
                                    </div>
                                    <span className={`${styles.statValue} ${exitSpreadData?.isInProfit ? styles.positive : styles.negative}`}>
                                        ${exitSpreadData ? (exitSpreadData.longBid - exitSpreadData.shortAsk).toFixed(2) : '-'} ({exitSpreadData?.exitSpread.toFixed(4) || '-'}%)
                                    </span>
                                    {selectedPosition.alarmEnabled && (
                                        <span className={styles.alarmThresholdDisplay}>
                                            Alarme à {selectedPosition.alarmThreshold?.toFixed(2)}%
                                        </span>
                                    )}
                                    {selectedPosition.alarmTriggered && (
                                        <button className={styles.dismissAlarmBtn} onClick={handleDismissAlarm}>
                                            ✓ Fermer l'alarme
                                        </button>
                                    )}
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>P&L $ (TOTAL)</span>
                                    <span className={`${styles.statValue} ${exitSpreadData?.isInProfit ? styles.positive : styles.negative}`}>
                                        ${currentPnL?.toFixed(2) || '-'}
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

            {/* Alarm Configuration Modal */}
            {showAlarmConfig && (
                <div className={styles.modalOverlay} onClick={() => setShowAlarmConfig(false)}>
                    <div className={styles.alarmModal} onClick={e => e.stopPropagation()}>
                        <h3>🔔 Configurer l'alarme spread sortie</h3>
                        <p>L'alarme sonnera quand le spread de sortie atteint ce seuil</p>
                        <div className={styles.alarmInputGroup}>
                            <span className={styles.alarmInputPrefix}>%</span>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="-0.05"
                                value={alarmThresholdInput}
                                onChange={(e) => setAlarmThresholdInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveAlarm()}
                                autoFocus
                            />
                        </div>
                        <div className={styles.alarmModalButtons}>
                            <button className={styles.alarmCancelBtn} onClick={() => setShowAlarmConfig(false)}>
                                Annuler
                            </button>
                            <button className={styles.alarmSaveBtn} onClick={handleSaveAlarm}>
                                Activer l'alarme
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
