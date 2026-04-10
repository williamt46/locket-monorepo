import { useMemo } from 'react';
import { getEukiContent, PHASE_MAPPING, SYMPTOM_MAPPING } from '@locket/shared';
import type { EukiItem } from '@locket/shared';
import type { CyclePhase } from '../utils/PredictionEngine';
import type { SymptomKey } from '../models/LogEntry';

export function useEukiContent(phase: CyclePhase | null, _dayInCycle: number) {
  const phaseSnippet = useMemo((): EukiItem | null => {
    if (!phase || phase === 'unknown') return null;
    const content = getEukiContent();
    const ids = PHASE_MAPPING[phase] ?? [];
    if (ids.length === 0) return null;
    for (const section of content.sections) {
      for (const item of section.items) {
        if (item.id === ids[0]) return item;
      }
    }
    return null;
  }, [phase]);

  const getSymptomContent = useMemo(
    () =>
      (symptom: SymptomKey): EukiItem | undefined => {
        const id = SYMPTOM_MAPPING[symptom];
        if (!id) return undefined;
        const content = getEukiContent();
        for (const section of content.sections) {
          for (const item of section.items) {
            if (item.id === id) return item;
          }
        }
        return undefined;
      },
    []
  );

  return { phaseSnippet, getSymptomContent };
}
