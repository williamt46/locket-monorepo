import { useState, useEffect, useMemo } from 'react';
import { UserConfig } from '../models/UserConfig';
import { calculatePredictedPeriods, getLatestPeriodStart } from '../utils/PredictionEngine';

export function usePredictions(decryptedData: Record<string, any>, config: UserConfig | null) {
    const [futureData, setFutureData] = useState<Record<string, boolean>>({});

    // Generate future predictions dynamically based on decrypted local data and UserConfig
    useEffect(() => {
        if (!config) {
            setFutureData({});
            return;
        }

        const latestStart = getLatestPeriodStart(decryptedData, config.lastPeriodDate);
        const predictions = calculatePredictedPeriods(
            latestStart,
            config.cycleLength,
            config.periodLength,
            3 // Forecast next 3 cycles
        );

        setFutureData(predictions);
    }, [decryptedData, config]);

    const calculateAverageCycle = (data: Record<string, { isPeriod: boolean }>): Record<number, number> => {
        // 1. Parse keys into Dates
        const dates: Date[] = [];
        Object.keys(data).forEach(key => {
            const parts = key.split('-');
            if (parts.length === 3 && data[key].isPeriod) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10);
                const d = parseInt(parts[2], 10);
                dates.push(new Date(y, m, d));
            }
        });

        if (dates.length < 2) {
            return {};
        }

        // 2. Sort Dates
        dates.sort((a, b) => a.getTime() - b.getTime());

        // 3. Identify Cycles (Group consecutive days into 'Periods', measure distance between Starts)
        const periodStarts: Date[] = [];
        let lastDate: Date | null = null;

        for (const date of dates) {
            if (!lastDate) {
                periodStarts.push(date);
            } else {
                // If gap is > 5 days (arbitrary threshold for new cycle vs same period), it's a new period
                const diffTime = Math.abs(date.getTime() - lastDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > 5) {
                    periodStarts.push(date);
                }
            }
            lastDate = date;
        }

        if (periodStarts.length < 2) return {};

        // 4. Calculate Average Interval per Year of the START date
        const intervalsByYear: Record<number, number[]> = {};

        for (let i = 1; i < periodStarts.length; i++) {
            const start = periodStarts[i - 1];
            const end = periodStarts[i];
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const year = end.getFullYear();
            if (!intervalsByYear[year]) intervalsByYear[year] = [];
            intervalsByYear[year].push(days);
        }

        // 5. Average them
        const avgs: Record<number, number> = {};
        for (const y in intervalsByYear) {
            const arr = intervalsByYear[y];
            const total = arr.reduce((sum, val) => sum + val, 0);
            avgs[y] = Math.round(total / arr.length);
        }

        return avgs;
    };

    const cycleStats = useMemo(() => calculateAverageCycle(decryptedData), [decryptedData]);

    return { futureData, cycleStats };
}
