import { useState, useEffect, useMemo } from 'react';
import { BaselineCycleData } from '../models/BaselineCycleData';
import { calculatePredictedPeriods, forwardCycleCount, getLatestPeriodStart, getCurrentPhase } from '../utils/PredictionEngine';
import type { CyclePhase } from '../utils/PredictionEngine';

export function usePredictions(decryptedData: Record<string, any>, config: BaselineCycleData | null) {
    // ⚡ Bolt: Use useMemo instead of useState + useEffect to derive futureData
    // This prevents a costly secondary re-render cycle in LedgerScreen whenever decryptedData or config changes.
    // Derived state is calculated synchronously during render, avoiding the cascade effect.
    const futureData = useMemo(() => {
        if (!config) {
            return {};
        }

        const latestStart = getLatestPeriodStart(decryptedData, config.lastPeriodDate);
        // T7/§4: no anchor (no logged Period Start and last-period-date unknown) →
        // predictions stay dormant until the first Period Start is logged.
        if (!latestStart) {
            return {};
        }
        // §5: blanket the full forward year of the calendar with watermark dots,
        // not just the old 3-cycle horizon. forwardCycleCount derives how many
        // cycles reach one year past today from the current anchor.
        return calculatePredictedPeriods(
            latestStart,
            config.cycleLength,
            config.periodLength,
            forwardCycleCount(latestStart, config.cycleLength)
        );
    }, [decryptedData, config]);

    const { phase: currentPhase, dayInCycle } = useMemo(() => {
        if (!config) return { phase: 'unknown' as CyclePhase, dayInCycle: 0 };
        const latestStart = getLatestPeriodStart(decryptedData, config.lastPeriodDate);
        // T7/§4: dormant until a Period Start anchors the cycle.
        if (!latestStart) return { phase: 'unknown' as CyclePhase, dayInCycle: 0 };
        return getCurrentPhase(latestStart, config.cycleLength, config.periodLength);
    }, [decryptedData, config]);

    return { futureData, currentPhase, dayInCycle };
}
