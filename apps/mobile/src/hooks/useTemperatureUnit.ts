import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { TemperatureUnit } from '../models/LogEntry';

/**
 * The temperature unit is a DISPLAY preference (last-used unit wins), not health
 * data — so it persists alongside the theme preference in SecureStore, NOT in
 * BaselineCycleData. Default is °F.
 */
export const TEMPERATURE_UNIT_KEY = 'locket_temperature_unit';

export function useTemperatureUnit(): [TemperatureUnit, (unit: TemperatureUnit) => void] {
  const [unit, setUnitState] = useState<TemperatureUnit>('F');

  useEffect(() => {
    SecureStore.getItemAsync(TEMPERATURE_UNIT_KEY)
      .then((saved) => {
        if (saved === 'F' || saved === 'C') setUnitState(saved);
      })
      .catch(() => { /* default to F */ });
  }, []);

  const setUnit = useCallback((next: TemperatureUnit) => {
    setUnitState(next);
    SecureStore.setItemAsync(TEMPERATURE_UNIT_KEY, next).catch(() => { });
  }, []);

  return [unit, setUnit];
}
