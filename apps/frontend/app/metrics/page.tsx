'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine,
} from 'recharts';
import { Sidebar } from '@/components/Sidebar';
import styles from './metrics.module.css';

interface DualSpreadData {
    time: string;
    formattedTime: string;
    spreadAB: number | null;
    spreadBA: number | null;
}

type TimeRange = '24H' | '7D' | '30D' | 'ALL';

export default function MetricsPage() {
    const { prices, exchanges, isConnected } = useSocket();

    // State
    const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedToken, setSelectedToken] = useState('');
    const [spreadData, setSpreadData] = useState<DualSpreadData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [range, setRange] = useState<TimeRange>('7D');

    // Get selected exchanges as array (max 2)
    const selectedArray = useMemo(() => Array.from(selectedExchanges), [selectedExchanges]);
    const exchangeA = selectedArray[0] || '';
    const exchangeB = selectedArray[1] || '';

    // Get available symbols filtered by search
    const filteredSymbols = useMemo(() => {
        const symbols = Array.from(prices.keys()).sort();
        if (!searchQuery) return symbols;
        const search = searchQuery.toLowerCase();
        return symbols.filter(s =>
            s.toLowerCase().includes(search) ||
            s.replace('-USD', '').toLowerCase().includes(search)
        );
    }, [prices, searchQuery]);

    // Auto-select first filtered symbol when search changes
    useEffect(() => {
        if (filteredSymbols.length > 0 && searchQuery) {
            // Check if selectedToken is in filtered list
            if (!filteredSymbols.includes(selectedToken)) {
                setSelectedToken(filteredSymbols[0]);
            }
        }
    }, [filteredSymbols, searchQuery, selectedToken]);

    // Handle exchange toggle - limit to 2
    const handleExchangeToggle = (exchangeId: string) => {
        setSelectedExchanges(prev => {
            const next = new Set(prev);
            if (next.has(exchangeId)) {
                next.delete(exchangeId);
            } else {
                if (next.size >= 2) {
                    const arr = Array.from(next);
                    next.delete(arr[0]);
                }
                next.add(exchangeId);
            }
            return next;
        });
    };

    // Fetch spread history
    useEffect(() => {
        if (!selectedToken || !exchangeA || !exchangeB) {
            setSpreadData([]);
            return;
        }

        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                const [responseAB, responseBA] = await Promise.all([
                    fetch(`/api/spread-history?symbol=${selectedToken}&buyExchange=${exchangeA}&sellExchange=${exchangeB}&range=${range}`),
                    fetch(`/api/spread-history?symbol=${selectedToken}&buyExchange=${exchangeB}&sellExchange=${exchangeA}&range=${range}`)
                ]);

                const dataAB = await responseAB.json();
                const dataBA = await responseBA.json();

                const timestampMap = new Map<string, DualSpreadData>();

                for (const point of (dataAB.data || [])) {
                    timestampMap.set(point.time, {
                        time: point.time,
                        formattedTime: new Date(point.time).toLocaleString('fr-FR', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        }),
                        spreadAB: point.spread,
                        spreadBA: null
                    });
                }

                for (const point of (dataBA.data || [])) {
                    const existing = timestampMap.get(point.time);
                    if (existing) {
                        existing.spreadBA = point.spread;
                    } else {
                        timestampMap.set(point.time, {
                            time: point.time,
                            formattedTime: new Date(point.time).toLocaleString('fr-FR', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            }),
                            spreadAB: null,
                            spreadBA: point.spread
                        });
                    }
                }

                const sorted = Array.from(timestampMap.values())
                    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

                setSpreadData(sorted);
            } catch (error) {
                console.error('Error fetching spread history:', error);
                setSpreadData([]);
            }
            setIsLoading(false);
        };

        fetchHistory();
    }, [selectedToken, exchangeA, exchangeB, range]);

    return (
        <div className={styles.layout}>
            {/* Sidebar with token search */}
            <Sidebar
                exchanges={exchanges}
                selectedExchanges={selectedExchanges}
                onExchangeToggle={handleExchangeToggle}
                searchQuery={searchQuery}
                onSearchChange={(q) => {
                    setSearchQuery(q);
                    // Auto-select first match
                    const symbols = Array.from(prices.keys());
                    const search = q.toLowerCase();
                    const matches = symbols.filter(s =>
                        s.toLowerCase().includes(search) ||
                        s.replace('-USD', '').toLowerCase().includes(search)
                    );
                    if (matches.length > 0) {
                        setSelectedToken(matches[0]);
                    }
                }}
                favorites={new Set()}
                onFavoriteToggle={() => { }}
                showFavoritesOnly={false}
                onShowFavoritesToggle={() => { }}
            />

            {/* Main Content */}
            <main className={styles.main}>
                {/* Header */}
                <header className={styles.header}>
                    <h1 className={styles.title}>
                        <span className={styles.logo}>📊</span>
                        Metrics
                    </h1>
                    <nav className={styles.nav}>
                        <a href="/" className={styles.navLinkInactive}>Dashboard</a>
                        <a href="/positions" className={styles.navLinkInactive}>Positions</a>
                        <a href="/metrics" className={styles.navLink}>Metrics</a>
                    </nav>
                    <div className={styles.status}>
                        <span className={`${styles.statusIndicator} ${isConnected ? styles.connected : ''}`} />
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </div>
                </header>

                {/* Controls - Range buttons and info */}
                <div className={styles.controls}>
                    {/* Range buttons */}
                    <div className={styles.rangeButtons}>
                        {(['24H', '7D', '30D', 'ALL'] as TimeRange[]).map(r => (
                            <button
                                key={r}
                                className={`${styles.rangeBtn} ${range === r ? styles.active : ''}`}
                                onClick={() => setRange(r)}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    {/* Info about selection */}
                    <div className={styles.info}>
                        {selectedToken && (
                            <span className={styles.tokenBadge}>
                                {selectedToken.replace('-USD', '')}
                            </span>
                        )}
                        {selectedArray.length === 2 && (
                            <span className={styles.exchangeInfo}>
                                {exchangeA.toUpperCase()} vs {exchangeB.toUpperCase()}
                            </span>
                        )}
                        {selectedArray.length < 2 && (
                            <span className={styles.hint}>← Sélectionne 2 exchanges</span>
                        )}
                    </div>
                </div>

                {/* Chart */}
                <div className={styles.chartContainer}>
                    {selectedArray.length < 2 ? (
                        <div className={styles.placeholder}>
                            Sélectionne exactement 2 exchanges dans la sidebar
                        </div>
                    ) : !selectedToken ? (
                        <div className={styles.placeholder}>
                            Recherche un token dans la sidebar
                        </div>
                    ) : isLoading ? (
                        <div className={styles.loading}>Chargement...</div>
                    ) : spreadData.length === 0 ? (
                        <div className={styles.placeholder}>Pas de données historiques</div>
                    ) : (
                        <>
                            <div className={styles.chartTitle}>
                                {selectedToken.replace('-USD', '')}: {exchangeA.toUpperCase()} vs {exchangeB.toUpperCase()}
                            </div>
                            <ResponsiveContainer width="100%" height={400}>
                                <LineChart data={spreadData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis
                                        dataKey="formattedTime"
                                        stroke="#666"
                                        tick={{ fill: '#888', fontSize: 11 }}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        stroke="#666"
                                        tick={{ fill: '#888', fontSize: 11 }}
                                        tickFormatter={(v) => `${v.toFixed(2)}%`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1a1d26',
                                            border: '1px solid #333',
                                            borderRadius: '8px'
                                        }}
                                        labelStyle={{ color: '#888' }}
                                    />
                                    <Legend />
                                    <ReferenceLine y={0} stroke="#555" strokeDasharray="4 4" />
                                    <Line
                                        type="monotone"
                                        dataKey="spreadAB"
                                        name={`Long ${exchangeA} / Short ${exchangeB}`}
                                        stroke="#22c55e"
                                        strokeWidth={2}
                                        dot={false}
                                        connectNulls
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="spreadBA"
                                        name={`Long ${exchangeB} / Short ${exchangeA}`}
                                        stroke="#f59e0b"
                                        strokeWidth={2}
                                        dot={false}
                                        connectNulls
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
