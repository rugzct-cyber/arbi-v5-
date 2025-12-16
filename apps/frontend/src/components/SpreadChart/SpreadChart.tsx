'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, IChartApi, AreaData, Time } from 'lightweight-charts';
import styles from './SpreadChart.module.css';

interface SpreadDataPoint {
    time: string;
    spread: number;
}

interface SpreadChartProps {
    symbol: string;
    buyExchange: string;
    sellExchange: string;
    currentSpread: number;
    onClose: () => void;
}

type TimeRange = '24H' | '7D' | '30D' | 'ALL';

export function SpreadChart({ symbol, buyExchange, sellExchange, currentSpread, onClose }: SpreadChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seriesRef = useRef<any>(null);

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
                setData(result.data || []);

                // Calculate stats
                if (result.data && result.data.length > 0) {
                    const spreads = result.data.map((d: SpreadDataPoint) => d.spread);
                    const avg = spreads.reduce((a: number, b: number) => a + b, 0) / spreads.length;
                    const min = Math.min(...spreads);
                    const max = Math.max(...spreads);
                    // Calculate percentile (where current spread ranks)
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

    // Initialize chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#9ca3af',
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 200,
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
            },
            timeScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                timeVisible: true,
            },
            crosshair: {
                horzLine: {
                    color: 'rgba(100, 200, 255, 0.5)',
                },
                vertLine: {
                    color: 'rgba(100, 200, 255, 0.5)',
                },
            },
        });

        // Use type assertion for API compatibility
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const areaSeries = (chart as any).addAreaSeries({
            lineColor: '#3b82f6',
            topColor: 'rgba(59, 130, 246, 0.4)',
            bottomColor: 'rgba(59, 130, 246, 0.0)',
            lineWidth: 2,
            priceFormat: {
                type: 'custom',
                formatter: (price: number) => price.toFixed(3) + '%',
            },
        });

        chartRef.current = chart;
        seriesRef.current = areaSeries;

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []);

    // Update chart data
    useEffect(() => {
        if (seriesRef.current && data.length > 0) {
            const chartData: AreaData<Time>[] = data.map(d => ({
                time: (new Date(d.time).getTime() / 1000) as Time,
                value: d.spread,
            }));
            seriesRef.current.setData(chartData);
            chartRef.current?.timeScale().fitContent();
        }
    }, [data]);

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
                {loading && <div className={styles.loading}>Loading...</div>}
                <div ref={chartContainerRef} className={styles.chart} />
            </div>
        </div>
    );
}
