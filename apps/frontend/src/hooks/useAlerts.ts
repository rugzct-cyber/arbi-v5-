'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PriceUpdate } from '@arbitrage/shared';

export interface SpreadAlert {
    id: string;
    symbol: string;
    buyExchange: string;
    sellExchange: string;
    threshold: number;
    direction: 'above' | 'below';
    enabled: boolean;
    createdAt: string;
    triggeredAt?: string;
}

export interface AlertTrigger {
    alert: SpreadAlert;
    currentSpread: number;
    timestamp: Date;
}

const STORAGE_KEY = 'spread-alerts';

// Generate unique ID
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Load alerts from localStorage
function loadAlerts(): SpreadAlert[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

// Save alerts to localStorage
function saveAlerts(alerts: SpreadAlert[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

export function useAlerts(prices: Map<string, Map<string, PriceUpdate>>) {
    const [alerts, setAlerts] = useState<SpreadAlert[]>([]);
    const [triggeredAlerts, setTriggeredAlerts] = useState<AlertTrigger[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Load alerts on mount
    useEffect(() => {
        setAlerts(loadAlerts());
        // Create audio element for notifications
        if (typeof window !== 'undefined') {
            audioRef.current = new Audio('/alert-sound.mp3');
            audioRef.current.volume = 0.5;
        }
    }, []);

    // Save alerts when they change
    useEffect(() => {
        if (alerts.length > 0 || loadAlerts().length > 0) {
            saveAlerts(alerts);
        }
    }, [alerts]);

    // Calculate spread for an alert
    const calculateSpread = useCallback((alert: SpreadAlert): number | null => {
        const symbolPrices = prices.get(alert.symbol);
        if (!symbolPrices) return null;

        const buyPrice = symbolPrices.get(alert.buyExchange);
        const sellPrice = symbolPrices.get(alert.sellExchange);

        if (!buyPrice || !sellPrice) return null;
        if (buyPrice.ask <= 0 || sellPrice.bid <= 0) return null;

        // Spread = (sell bid - buy ask) / buy ask * 100
        return ((sellPrice.bid - buyPrice.ask) / buyPrice.ask) * 100;
    }, [prices]);

    // Check alerts against current prices
    useEffect(() => {
        const enabledAlerts = alerts.filter(a => a.enabled);
        const newTriggers: AlertTrigger[] = [];

        for (const alert of enabledAlerts) {
            const spread = calculateSpread(alert);
            if (spread === null) continue;

            const shouldTrigger = alert.direction === 'above'
                ? spread >= alert.threshold
                : spread <= alert.threshold;

            if (shouldTrigger && !alert.triggeredAt) {
                newTriggers.push({
                    alert,
                    currentSpread: spread,
                    timestamp: new Date(),
                });

                // Mark alert as triggered
                setAlerts(prev => prev.map(a =>
                    a.id === alert.id
                        ? { ...a, triggeredAt: new Date().toISOString() }
                        : a
                ));
            }
        }

        if (newTriggers.length > 0) {
            setTriggeredAlerts(prev => [...newTriggers, ...prev].slice(0, 10));
            // Play sound
            audioRef.current?.play().catch(() => { });
        }
    }, [alerts, prices, calculateSpread]);

    // Add a new alert
    const addAlert = useCallback((
        symbol: string,
        buyExchange: string,
        sellExchange: string,
        threshold: number,
        direction: 'above' | 'below' = 'above'
    ): SpreadAlert => {
        const newAlert: SpreadAlert = {
            id: generateId(),
            symbol,
            buyExchange,
            sellExchange,
            threshold,
            direction,
            enabled: true,
            createdAt: new Date().toISOString(),
        };
        setAlerts(prev => [newAlert, ...prev]);
        return newAlert;
    }, []);

    // Remove an alert
    const removeAlert = useCallback((id: string): void => {
        setAlerts(prev => prev.filter(a => a.id !== id));
    }, []);

    // Toggle alert enabled/disabled
    const toggleAlert = useCallback((id: string): void => {
        setAlerts(prev => prev.map(a =>
            a.id === id ? { ...a, enabled: !a.enabled, triggeredAt: undefined } : a
        ));
    }, []);

    // Reset triggered state (re-arm the alert)
    const resetAlert = useCallback((id: string): void => {
        setAlerts(prev => prev.map(a =>
            a.id === id ? { ...a, triggeredAt: undefined } : a
        ));
    }, []);

    // Dismiss a triggered alert notification
    const dismissTrigger = useCallback((alertId: string): void => {
        setTriggeredAlerts(prev => prev.filter(t => t.alert.id !== alertId));
    }, []);

    // Get current spread for an alert
    const getSpread = useCallback((alert: SpreadAlert): number | null => {
        return calculateSpread(alert);
    }, [calculateSpread]);

    return {
        alerts,
        triggeredAlerts,
        addAlert,
        removeAlert,
        toggleAlert,
        resetAlert,
        dismissTrigger,
        getSpread,
    };
}
