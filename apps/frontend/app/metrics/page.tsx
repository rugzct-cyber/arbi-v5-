'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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

export default function MetricsPage() {
    const { prices, exchanges, isConnected } = useSocket();

    // State
    const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedToken, setSelectedToken] = useState('');
    const [showTokenDropdown, setShowTokenDropdown] = useState(false);
    const [spreadData, setSpreadData] = useState<DualSpreadData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [range, setRange] = useState('7D');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Get selected exchanges as array (max 2)
    const selectedArray = useMemo(() => Array.from(selectedExchanges), [selectedExchanges]);
    const exchangeA = selectedArray[0] || '';
    const exchangeB = selectedArray[1] || '';

    // Get available symbols
    const symbols = useMemo(() => {
        return Array.from(prices.keys()).sort();
    }, [prices]);

    // Filter symbols based on search
    const filteredSymbols = useMemo(() => {
        if (!searchQuery) return symbols;
        const search = searchQuery.toLowerCase();
        return symbols.filter(s =>
            s.toLowerCase().includes(search) ||
            s.replace('-USD', '').toLowerCase().includes(search)
        );
    }, [symbols, searchQuery]);

    // Handle exchange toggle - limit to 2
    const handleExchangeToggle = (exchangeId: string) => {
        setSelectedExchanges(prev => {
            const next = new Set(prev);
            if (next.has(exchangeId)) {
                next.delete(exchangeId);
            } else {
                // Limit to 2 exchanges
                if (next.size >= 2) {
                    // Remove the oldest one
                    const arr = Array.from(next);
                    next.delete(arr[0]);
                }
                next.add(exchangeId);
            }
            return next;
        });
    };

    // Fetch spread history when we have token and 2 exchanges
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

                // Combine by timestamp
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

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowTokenDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectToken = (s: string) => {
        setSelectedToken(s);
        setSearchQuery(s.replace('-USD', ''));
        setShowTokenDropdown(false);
    };

    return (
        <div className={styles.layout}>
            {/* Reuse Sidebar */}
            <Sidebar
                exchanges={exchanges}
                selectedExchanges={selectedExchanges}
                onExchangeToggle={handleExchangeToggle}
                searchQuery=""
                onSearchChange={() => { }}
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

                {/* Controls - just token search and range */}
                <div className={styles.controls}>
                    <div className={styles.field} ref={dropdownRef}>
                        <label>Token</label>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => {
                                setSearchQuery(e.target.value);
                                setShowTokenDropdown(true);
                                if (!e.target.value) setSelectedToken('');
                            }}
                            onFocus={() => setShowTokenDropdown(true)}
                            placeholder="Search token..."
                        />
                        {showTokenDropdown && (
                            <div className={styles.dropdown}>
                                {filteredSymbols.length === 0 ? (
                                    <div className={styles.dropdownEmpty}>No tokens found</div>
                                ) : (
                                    filteredSymbols.slice(0, 10).map(s => (
                                        <div
                                            key={s}
                                            className={`${styles.dropdownItem} ${selectedToken === s ? styles.selected : ''}`}
                                            onClick={() => handleSelectToken(s)}
                                        >
                                            {s.replace('-USD', '')}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <div className={styles.field}>
                        <label>Range</label>
                        <select value={range} onChange={e => setRange(e.target.value)}>
                            <option value="24H">24H</option>
                            <option value="7D">7 Days</option>
                            <option value="30D">30 Days</option>
                            <option value="ALL">All</option>
                        </select>
                    </div>

                    {/* Info about selected exchanges */}
                    <div className={styles.info}>
                        {selectedArray.length < 2 ? (
                            <span className={styles.hint}>← Sélectionne 2 exchanges dans la sidebar</span>
                        ) : (
                            <span className={styles.selected}>
                                {exchangeA.toUpperCase()} vs {exchangeB.toUpperCase()}
                            </span>
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
                            Sélectionne un token pour voir le graphique
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
