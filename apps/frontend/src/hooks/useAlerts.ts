'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PriceUpdate } from '@arbitrage/shared';

export interface SpreadAlert {
    id: string;
    symbol: string;
    exchangeA: string;
    exchangeB: string;
    threshold: number;
    enabled: boolean;
    createdAt: string;
    triggeredAt?: string;
}

export interface AlertTrigger {
    alert: SpreadAlert;
    currentSpread: number;
    direction: string; // "A→B" or "B→A"
    timestamp: Date;
}

const STORAGE_KEY = 'spread-alerts-v2';

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
    const audioContextRef = useRef<AudioContext | null>(null);
    const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Play alert sound using Web Audio API
    const playAlertSound = useCallback(() => {
        try {
            // Create audio context on first use (needs user interaction on some browsers)
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioContextRef.current;

            // Create oscillator for beep sound
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Configure sound: 2 beeps
            oscillator.frequency.value = 880; // A5 note
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.15);

            // Second beep
            setTimeout(() => {
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.frequency.value = 1046; // C6 note (higher)
                osc2.type = 'sine';
                gain2.gain.setValueAtTime(0.3, ctx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
                osc2.start(ctx.currentTime);
                osc2.stop(ctx.currentTime + 0.2);
            }, 180);
        } catch (e) {
            console.log('Audio not available:', e);
        }
    }, []);

    // Repeat sound every 10 seconds while there are triggered alerts
    useEffect(() => {
        if (triggeredAlerts.length > 0) {
            // Play immediately
            playAlertSound();
            // Then repeat every 10 seconds
            soundIntervalRef.current = setInterval(playAlertSound, 10000);
        } else {
            // Stop repeating when no more triggered alerts
            if (soundIntervalRef.current) {
                clearInterval(soundIntervalRef.current);
                soundIntervalRef.current = null;
            }
        }
        return () => {
            if (soundIntervalRef.current) {
                clearInterval(soundIntervalRef.current);
            }
        };
    }, [triggeredAlerts.length, playAlertSound]);

    // Load alerts on mount
    useEffect(() => {
        setAlerts(loadAlerts());
    }, []);

    // Save alerts when they change
    useEffect(() => {
        if (alerts.length > 0 || loadAlerts().length > 0) {
            saveAlerts(alerts);
        }
    }, [alerts]);

    // Calculate spread for an alert (returns best spread regardless of direction)
    const calculateSpread = useCallback((alert: SpreadAlert): { spread: number; direction: string } | null => {
        const symbolPrices = prices.get(alert.symbol);
        if (!symbolPrices) return null;

        const priceA = symbolPrices.get(alert.exchangeA);
        const priceB = symbolPrices.get(alert.exchangeB);

        if (!priceA || !priceB) return null;
        if (priceA.ask <= 0 || priceA.bid <= 0 || priceB.ask <= 0 || priceB.bid <= 0) return null;

        // Calculate spread both ways
        // Direction A→B: Buy on A (ask), Sell on B (bid)
        const spreadAtoB = ((priceB.bid - priceA.ask) / priceA.ask) * 100;
        // Direction B→A: Buy on B (ask), Sell on A (bid)
        const spreadBtoA = ((priceA.bid - priceB.ask) / priceB.ask) * 100;

        // Return the best spread (highest positive spread)
        if (spreadAtoB >= spreadBtoA) {
            return { spread: spreadAtoB, direction: `${alert.exchangeA}→${alert.exchangeB}` };
        } else {
            return { spread: spreadBtoA, direction: `${alert.exchangeB}→${alert.exchangeA}` };
        }
    }, [prices]);

    // Check alerts against current prices
    useEffect(() => {
        const enabledAlerts = alerts.filter(a => a.enabled);
        const newTriggers: AlertTrigger[] = [];

        for (const alert of enabledAlerts) {
            const result = calculateSpread(alert);
            if (result === null) continue;

            const shouldTrigger = result.spread >= alert.threshold;

            if (shouldTrigger && !alert.triggeredAt) {
                newTriggers.push({
                    alert,
                    currentSpread: result.spread,
                    direction: result.direction,
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
        }
    }, [alerts, prices, calculateSpread]);

    // Add a new alert
    const addAlert = useCallback((
        symbol: string,
        exchangeA: string,
        exchangeB: string,
        threshold: number
    ): SpreadAlert => {
        const newAlert: SpreadAlert = {
            id: generateId(),
            symbol,
            exchangeA,
            exchangeB,
            threshold,
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
    const getSpread = useCallback((alert: SpreadAlert): { spread: number; direction: string } | null => {
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
