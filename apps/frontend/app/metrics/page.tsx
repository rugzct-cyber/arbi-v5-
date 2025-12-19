'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import styles from './metrics.module.css';

const EXCHANGES = ['paradex', 'vest', 'extended', 'hyperliquid', 'lighter', 'pacifica', 'ethereal', 'nado'];

interface SpreadDataPoint {
    timestamp: string;
    spreadAtoB: number;
    spreadBtoA: number;
}

export default function MetricsPage() {
    const { prices, exchanges, isConnected } = useSocket();

    // State
    const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(new Set(EXCHANGES));
    const [tokenSearch, setTokenSearch] = useState('');
    const [selectedToken, setSelectedToken] = useState('');
    const [exchangeA, setExchangeA] = useState('');
    const [exchangeB, setExchangeB] = useState('');
    const [showTokenDropdown, setShowTokenDropdown] = useState(false);
    const [spreadHistory, setSpreadHistory] = useState<SpreadDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [range, setRange] = useState('24H');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Get available symbols
    const symbols = useMemo(() => {
        return Array.from(prices.keys()).sort();
    }, [prices]);

    // Filter symbols based on search
    const filteredSymbols = useMemo(() => {
        if (!tokenSearch) return symbols;
        const search = tokenSearch.toLowerCase();
        return symbols.filter(s =>
            s.toLowerCase().includes(search) ||
            s.replace('-USD', '').toLowerCase().includes(search)
        );
    }, [symbols, tokenSearch]);

    // Get exchanges that have data for selected token
    const availableExchanges = useMemo(() => {
        if (!selectedToken) return Array.from(selectedExchanges);
        const symbolPrices = prices.get(selectedToken);
        if (!symbolPrices) return Array.from(selectedExchanges);
        return Array.from(symbolPrices.keys()).filter(ex => selectedExchanges.has(ex)).sort();
    }, [selectedToken, prices, selectedExchanges]);

    // Fetch spread history when parameters change
    useEffect(() => {
        if (!selectedToken || !exchangeA || !exchangeB) {
            setSpreadHistory([]);
            return;
        }

        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                // Fetch both directions
                const [responseAB, responseBA] = await Promise.all([
                    fetch(`/api/spread-history?symbol=${selectedToken}&buyExchange=${exchangeA}&sellExchange=${exchangeB}&range=${range}`),
                    fetch(`/api/spread-history?symbol=${selectedToken}&buyExchange=${exchangeB}&sellExchange=${exchangeA}&range=${range}`)
                ]);

                const dataAB = await responseAB.json();
                const dataBA = await responseBA.json();

                // Combine data points by timestamp
                const combined: SpreadDataPoint[] = [];
                const abData = dataAB.data || [];
                const baData = dataBA.data || [];

                // Create a map of timestamps
                const timestampMap = new Map<string, SpreadDataPoint>();

                for (const point of abData) {
                    timestampMap.set(point.timestamp, {
                        timestamp: point.timestamp,
                        spreadAtoB: point.spread,
                        spreadBtoA: 0
                    });
                }

                for (const point of baData) {
                    const existing = timestampMap.get(point.timestamp);
                    if (existing) {
                        existing.spreadBtoA = point.spread;
                    } else {
                        timestampMap.set(point.timestamp, {
                            timestamp: point.timestamp,
                            spreadAtoB: 0,
                            spreadBtoA: point.spread
                        });
                    }
                }

                // Sort by timestamp
                const sorted = Array.from(timestampMap.values())
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                setSpreadHistory(sorted);
            } catch (error) {
                console.error('Error fetching spread history:', error);
                setSpreadHistory([]);
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
        setTokenSearch(s.replace('-USD', ''));
        setShowTokenDropdown(false);
        setExchangeA('');
        setExchangeB('');
    };

    const handleExchangeToggle = (exchangeId: string) => {
        setSelectedExchanges(prev => {
            const next = new Set(prev);
            if (next.has(exchangeId)) {
                next.delete(exchangeId);
            } else {
                next.add(exchangeId);
            }
            return next;
        });
    };

    // Calculate chart dimensions
    const chartWidth = 800;
    const chartHeight = 300;
    const padding = { top: 20, right: 60, bottom: 40, left: 60 };

    // Generate SVG path for spread data
    const generatePath = (data: SpreadDataPoint[], key: 'spreadAtoB' | 'spreadBtoA') => {
        if (data.length === 0) return '';

        const values = data.map(d => d[key]);
        const minVal = Math.min(...values, 0);
        const maxVal = Math.max(...values);
        const range = maxVal - minVal || 1;

        const xScale = (chartWidth - padding.left - padding.right) / (data.length - 1 || 1);
        const yScale = (chartHeight - padding.top - padding.bottom) / range;

        return data.map((d, i) => {
            const x = padding.left + i * xScale;
            const y = chartHeight - padding.bottom - (d[key] - minVal) * yScale;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
    };

    // Get min/max for Y axis
    const yAxisRange = useMemo(() => {
        if (spreadHistory.length === 0) return { min: -1, max: 1 };
        const allValues = spreadHistory.flatMap(d => [d.spreadAtoB, d.spreadBtoA]);
        return {
            min: Math.min(...allValues, 0),
            max: Math.max(...allValues)
        };
    }, [spreadHistory]);

    return (
        <div className={styles.layout}>
            {/* Sidebar */}
            <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''}`}>
                <button
                    className={styles.collapseBtn}
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                    {sidebarCollapsed ? '»' : '«'}
                </button>

                {!sidebarCollapsed && (
                    <>
                        <div className={styles.section}>
                            <h3 className={styles.sectionTitle}>EXCHANGES</h3>
                            <ul className={styles.exchangeList}>
                                {EXCHANGES.map(ex => (
                                    <li key={ex} className={styles.exchangeItem}>
                                        <label className={styles.exchangeLabel}>
                                            <input
                                                type="checkbox"
                                                checked={selectedExchanges.has(ex)}
                                                onChange={() => handleExchangeToggle(ex)}
                                            />
                                            <span className={`${styles.statusDot} ${exchanges.some(e => e.id === ex && e.connected) ? styles.online : styles.offline}`} />
                                            <span>{ex.toUpperCase()}</span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}
            </aside>

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

                {/* Controls */}
                <div className={styles.controls}>
                    {/* Token Search */}
                    <div className={styles.field} ref={dropdownRef}>
                        <label>Token</label>
                        <input
                            type="text"
                            value={tokenSearch}
                            onChange={e => {
                                setTokenSearch(e.target.value);
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

                    {/* Exchange A */}
                    <div className={styles.field}>
                        <label>Exchange A</label>
                        <select
                            value={exchangeA}
                            onChange={e => setExchangeA(e.target.value)}
                            disabled={!selectedToken}
                        >
                            <option value="">Select...</option>
                            {availableExchanges.filter(ex => ex !== exchangeB).map(ex => (
                                <option key={ex} value={ex}>{ex}</option>
                            ))}
                        </select>
                    </div>

                    {/* Exchange B */}
                    <div className={styles.field}>
                        <label>Exchange B</label>
                        <select
                            value={exchangeB}
                            onChange={e => setExchangeB(e.target.value)}
                            disabled={!selectedToken}
                        >
                            <option value="">Select...</option>
                            {availableExchanges.filter(ex => ex !== exchangeA).map(ex => (
                                <option key={ex} value={ex}>{ex}</option>
                            ))}
                        </select>
                    </div>

                    {/* Range */}
                    <div className={styles.field}>
                        <label>Range</label>
                        <select value={range} onChange={e => setRange(e.target.value)}>
                            <option value="24H">24H</option>
                            <option value="7D">7 Days</option>
                            <option value="30D">30 Days</option>
                            <option value="ALL">All</option>
                        </select>
                    </div>
                </div>

                {/* Chart */}
                <div className={styles.chartContainer}>
                    {!selectedToken || !exchangeA || !exchangeB ? (
                        <div className={styles.placeholder}>
                            Select a token and two exchanges to view spread history
                        </div>
                    ) : isLoading ? (
                        <div className={styles.loading}>Loading spread data...</div>
                    ) : spreadHistory.length === 0 ? (
                        <div className={styles.placeholder}>No historical data available</div>
                    ) : (
                        <>
                            <div className={styles.chartTitle}>
                                {selectedToken.replace('-USD', '')} Spread: {exchangeA.toUpperCase()} vs {exchangeB.toUpperCase()}
                            </div>
                            <div className={styles.legend}>
                                <span className={styles.legendItem}>
                                    <span className={styles.legendColorA}></span>
                                    Long {exchangeA} / Short {exchangeB}
                                </span>
                                <span className={styles.legendItem}>
                                    <span className={styles.legendColorB}></span>
                                    Long {exchangeB} / Short {exchangeA}
                                </span>
                            </div>
                            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className={styles.chart}>
                                {/* Grid lines */}
                                <line x1={padding.left} y1={padding.top} x2={padding.left} y2={chartHeight - padding.bottom} stroke="#333" />
                                <line x1={padding.left} y1={chartHeight - padding.bottom} x2={chartWidth - padding.right} y2={chartHeight - padding.bottom} stroke="#333" />

                                {/* Zero line */}
                                {yAxisRange.min < 0 && (
                                    <line
                                        x1={padding.left}
                                        y1={chartHeight - padding.bottom - (-yAxisRange.min) / (yAxisRange.max - yAxisRange.min) * (chartHeight - padding.top - padding.bottom)}
                                        x2={chartWidth - padding.right}
                                        y2={chartHeight - padding.bottom - (-yAxisRange.min) / (yAxisRange.max - yAxisRange.min) * (chartHeight - padding.top - padding.bottom)}
                                        stroke="#555"
                                        strokeDasharray="4 4"
                                    />
                                )}

                                {/* Y axis labels */}
                                <text x={padding.left - 10} y={padding.top + 10} fill="#888" fontSize="12" textAnchor="end">
                                    {yAxisRange.max.toFixed(2)}%
                                </text>
                                <text x={padding.left - 10} y={chartHeight - padding.bottom} fill="#888" fontSize="12" textAnchor="end">
                                    {yAxisRange.min.toFixed(2)}%
                                </text>

                                {/* Spread A→B line */}
                                <path
                                    d={generatePath(spreadHistory, 'spreadAtoB')}
                                    fill="none"
                                    stroke="#22c55e"
                                    strokeWidth="2"
                                />

                                {/* Spread B→A line */}
                                <path
                                    d={generatePath(spreadHistory, 'spreadBtoA')}
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth="2"
                                />
                            </svg>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
