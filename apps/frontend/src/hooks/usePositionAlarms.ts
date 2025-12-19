'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { PriceUpdate } from '@arbitrage/shared';

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
    alarmEnabled?: boolean;
    alarmThreshold?: number;
    alarmTriggered?: boolean;
}

interface TriggeredAlarm {
    positionId: string;
    token: string;
    exitSpread: number;
    threshold: number;
    timestamp: Date;
}

const STORAGE_KEY = 'positions';

// Load positions from localStorage
function loadPositions(): Position[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

// Save positions to localStorage
function savePositions(positions: Position[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

export function usePositionAlarms(prices: Map<string, Map<string, PriceUpdate>>) {
    const [triggeredAlarm, setTriggeredAlarm] = useState<TriggeredAlarm | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastCheckRef = useRef<number>(0);

    // Play loud alarm sound with 3 repetitions
    const playAlarmSound = useCallback(() => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioContextRef.current;

            const playPattern = (delay: number) => {
                const notes = [523, 659, 784, 1046];
                notes.forEach((freq, i) => {
                    setTimeout(() => {
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.frequency.value = freq;
                        osc.type = 'square';
                        gain.gain.setValueAtTime(0.6, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                        osc.start(ctx.currentTime);
                        osc.stop(ctx.currentTime + 0.3);
                    }, delay + i * 100);
                });
            };

            playPattern(0);
            playPattern(600);
            playPattern(1200);
        } catch (e) {
            console.log('Audio not available:', e);
        }
    }, []);

    // Check alarms for all positions
    useEffect(() => {
        // Only check every 500ms to avoid excessive processing
        const now = Date.now();
        if (now - lastCheckRef.current < 500) return;
        lastCheckRef.current = now;

        const positions = loadPositions();

        for (const position of positions) {
            if (!position.alarmEnabled || position.alarmTriggered) continue;
            if (position.alarmThreshold === undefined) continue;

            // Calculate exit spread
            const tokenPrices = prices.get(position.token);
            if (!tokenPrices) continue;

            const longPrice = tokenPrices.get(position.longExchange);
            const shortPrice = tokenPrices.get(position.shortExchange);
            if (!longPrice || !shortPrice) continue;

            const exitSpread = shortPrice.ask > 0
                ? ((longPrice.bid - shortPrice.ask) / shortPrice.ask * 100)
                : 0;

            // Check if alarm should trigger
            if (exitSpread >= position.alarmThreshold) {
                // Trigger alarm!
                playAlarmSound();

                // Mark as triggered in localStorage
                const updatedPositions = positions.map(p =>
                    p.id === position.id ? { ...p, alarmTriggered: true } : p
                );
                savePositions(updatedPositions);

                // Set triggered alarm for UI
                setTriggeredAlarm({
                    positionId: position.id,
                    token: position.token,
                    exitSpread: Math.round(exitSpread * 10000) / 10000,
                    threshold: position.alarmThreshold,
                    timestamp: new Date(),
                });

                // Repeat sound every 10 seconds
                soundIntervalRef.current = setInterval(playAlarmSound, 10000);
                break; // Only trigger one alarm at a time
            }
        }
    }, [prices, playAlarmSound]);

    // Dismiss alarm
    const dismissAlarm = useCallback(() => {
        if (soundIntervalRef.current) {
            clearInterval(soundIntervalRef.current);
            soundIntervalRef.current = null;
        }

        if (triggeredAlarm) {
            const positions = loadPositions();
            const updatedPositions = positions.map(p =>
                p.id === triggeredAlarm.positionId
                    ? { ...p, alarmEnabled: false, alarmTriggered: false }
                    : p
            );
            savePositions(updatedPositions);
        }

        setTriggeredAlarm(null);
    }, [triggeredAlarm]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (soundIntervalRef.current) {
                clearInterval(soundIntervalRef.current);
            }
        };
    }, []);

    return {
        triggeredAlarm,
        dismissAlarm,
    };
}
