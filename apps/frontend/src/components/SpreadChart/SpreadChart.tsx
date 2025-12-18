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
import styles from './SpreadChart.module.css';

interface SpreadDataPoint {
    time: string;
    spread: number;
    formattedTime: string;
}

interface SpreadChartProps {
    symbol: string;
    buyExchange: string;
    sellExchange: string;
    currentSpread: number;
    onClose: () => void;
}

type TimeRange = '24H' | '7D' | '30D' | 'ALL';

// Custom tooltip component
function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        return (
            <div className={styles.tooltip}>
                <p className={styles.tooltipTime}>{label}</p>
                <p className={styles.tooltipValue}>
                    Spread: <span className={styles.tooltipSpread}>{payload[0].value.toFixed(4)}%</span>
                </p>
            </div>
        );
    }
    return null;
}

export function SpreadChart({ symbol, buyExchange, sellExchange, currentSpread, onClose }: SpreadChartProps) {
    const [timeRange, setTimeRange] = useState<TimeRange>('7D');
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
            const res = await fetch(`/api/spread-history?symbol=${encodeURIComponent(symbol)}&buyExchange=${buyExchange}&sellExchange=${sellExchange}&range=${timeRange}`);
            if (res.ok) {
                const result = await res.json();

                // Format data for Recharts
                const formattedData = (result.data || []).map((d: { time: string; spread: number }) => ({
                    ...d,
                    formattedTime: new Date(d.time).toLocaleString('fr-FR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                }));

                // Add current spread as the last point for "live" illusion
                const dataWithCurrent = [
                    ...formattedData,
                    {
                        time: new Date().toISOString(),
                        spread: currentSpread,
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
                    const belowCurrent = spreads.filter((s: number) => s < currentSpread).length;
                    const percentile = Math.round((belowCurrent / spreads.length) * 100);
                    setStats({ avg, min, max, percentile });
                }
            }
        } catch (error) {
            console.error('Failed to fetch spread history:', error);
        }
        setLoading(false);
    }, [symbol, buyExchange, sellExchange, timeRange, currentSpread]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className={styles.chartContainer}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <span className={styles.title}>{symbol.replace('-USD', '')}</span>
                    <span className={styles.subtitle}>SPREAD ({buyExchange} vs {sellExchange})</span>
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
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className={styles.statsBar}>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>CURRENT SPREAD</span>
                    <span className={`${styles.statValue} ${styles.statCurrent}`}>{currentSpread.toFixed(3)}%</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>AVERAGE ({timeRange})</span>
                    <span className={styles.statValue}>{stats.avg.toFixed(3)}%</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>MIN</span>
                    <span className={`${styles.statValue} ${styles.statNegative}`}>{stats.min.toFixed(3)}%</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>MAX</span>
                    <span className={`${styles.statValue} ${styles.statPositive}`}>{stats.max.toFixed(3)}%</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>PERCENTILE ({timeRange})</span>
                    <span className={styles.statValue}>{stats.percentile}%</span>
                </div>
            </div>

            {/* Chart */}
            <div className={styles.chartWrapper}>
                {loading ? (
                    <div className={styles.loading}>Loading...</div>
                ) : data.length === 0 ? (
                    <div className={styles.loading}>No historical data available</div>
                ) : (
                    <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="spreadGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                                y={stats.avg}
                                stroke="#22c55e"
                                strokeDasharray="5 5"
                                label={{ value: 'Avg', fill: '#22c55e', fontSize: 10, position: 'right' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="spread"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#spreadGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
