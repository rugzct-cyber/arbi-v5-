'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import styles from './ExitSpreadChart.module.css';

interface SpreadDataPoint {
    time: string;
    spread: number;
    formattedTime: string;
    longBid?: number;
    shortAsk?: number;
}

interface ExitSpreadChartProps {
    symbol: string;
    longExchange: string;
    shortExchange: string;
    currentExitSpread: number;
    entryPriceLong: number;
    entryPriceShort: number;
}

type TimeRange = '24H' | '7D' | '30D' | 'ALL';

// Custom tooltip component
function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className={styles.tooltip}>
                <p className={styles.tooltipTime}>{label}</p>
                <p className={styles.tooltipValue}>
                    Exit Spread: <span className={styles.tooltipSpread}>{payload[0].value.toFixed(4)}%</span>
                </p>
                {data.longBid && data.shortAsk && (
                    <p className={styles.tooltipPrices}>
                        Long BID: ${data.longBid.toFixed(2)} | Short ASK: ${data.shortAsk.toFixed(2)}
                    </p>
                )}
            </div>
        );
    }
    return null;
}

export function ExitSpreadChart({
    symbol,
    longExchange,
    shortExchange,
    currentExitSpread,
    entryPriceLong,
    entryPriceShort
}: ExitSpreadChartProps) {
    const [timeRange, setTimeRange] = useState<TimeRange>('24H');
    const [data, setData] = useState<SpreadDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        avg: 0,
        min: 0,
        max: 0,
        percentile: 0
    });

    // Fetch historical data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `/api/exit-spread-history?symbol=${encodeURIComponent(symbol)}&longExchange=${longExchange}&shortExchange=${shortExchange}&range=${timeRange}`
            );
            if (res.ok) {
                const result = await res.json();

                // Format data for Recharts
                const formattedData = (result.data || []).map((d: { time: string; spread: number; longBid?: number; shortAsk?: number }) => ({
                    ...d,
                    formattedTime: new Date(d.time).toLocaleString('fr-FR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                }));

                // Add current exit spread as the last point for "live" illusion
                const dataWithCurrent = [
                    ...formattedData,
                    {
                        time: new Date().toISOString(),
                        spread: currentExitSpread,
                        formattedTime: 'Now',
                        isLive: true,
                    }
                ];

                setData(dataWithCurrent);

                // Calculate stats (excluding the live point)
                if (result.data && result.data.length > 0) {
                    const spreads = result.data.map((d: SpreadDataPoint) => d.spread);
                    const avg = spreads.reduce((a: number, b: number) => a + b, 0) / spreads.length;
                    const min = Math.min(...spreads);
                    const max = Math.max(...spreads);
                    const belowCurrent = spreads.filter((s: number) => s < currentExitSpread).length;
                    const percentile = Math.round((belowCurrent / spreads.length) * 100);
                    setStats({ avg, min, max, percentile });
                }
            }
        } catch (error) {
            console.error('Failed to fetch exit spread history:', error);
        }
        setLoading(false);
    }, [symbol, longExchange, shortExchange, timeRange, currentExitSpread]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Calculate entry spread for reference
    const entrySpread = entryPriceShort > 0
        ? ((entryPriceLong - entryPriceShort) / entryPriceShort * 100)
        : 0;

    return (
        <div className={styles.chartContainer}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <span className={styles.title}>Historique Exit Spread</span>
                    <span className={styles.subtitle}>
                        {longExchange.toUpperCase()} BID vs {shortExchange.toUpperCase()} ASK
                    </span>
                </div>
                <div className={styles.controls}>
                    {(['24H', '7D', '30D', 'ALL'] as TimeRange[]).map(range => (
                        <button
                            key={range}
                            className={`${styles.rangeBtn} ${timeRange === range ? styles.rangeBtnActive : ''}`}
                            onClick={() => setTimeRange(range)}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Bar */}
            <div className={styles.statsBar}>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>EXIT SPREAD ACTUEL</span>
                    <span className={`${styles.statValue} ${currentExitSpread > 0 ? styles.statPositive : styles.statNegative}`}>
                        {currentExitSpread.toFixed(4)}%
                    </span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>SPREAD ENTRÉE</span>
                    <span className={styles.statValue}>{entrySpread.toFixed(4)}%</span>
                </div>
            </div>

            {/* Chart */}
            <div className={styles.chartWrapper}>
                {loading ? (
                    <div className={styles.loading}>Chargement des données historiques...</div>
                ) : data.length === 0 ? (
                    <div className={styles.loading}>Aucune donnée historique disponible</div>
                ) : (
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="exitSpreadGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="rgba(255, 255, 255, 0.05)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="formattedTime"
                                stroke="#64748b"
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                tickLine={false}
                                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                            />
                            <YAxis
                                stroke="#64748b"
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                tickLine={false}
                                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                                tickFormatter={(value) => `${value.toFixed(2)}%`}
                                width={60}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine
                                y={0}
                                stroke="#ef4444"
                                strokeDasharray="3 3"
                                label={{ value: '0%', fill: '#ef4444', fontSize: 10, position: 'left' }}
                            />
                            <ReferenceLine
                                y={entrySpread}
                                stroke="#f59e0b"
                                strokeDasharray="5 5"
                                strokeWidth={2}
                                label={{ value: 'Entrée', fill: '#f59e0b', fontSize: 10, position: 'right' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="spread"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#exitSpreadGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
