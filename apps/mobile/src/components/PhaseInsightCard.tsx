import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useEukiContent } from '../hooks/useEukiContent';
import { ContentSheet } from './ContentSheet';
import type { CyclePhase } from '../utils/PredictionEngine';
import type { EukiItem } from '@locket/shared';

const PHASE_COLORS: Record<CyclePhase, string> = {
  menstrual: colors.warmTerracotta,
  follicular: colors.arcticTeal,
  ovulatory: colors.orangePeel,
  luteal: colors.deepReflectiveViolet,
  unknown: colors.locketBlue,
};

const PHASE_ICONS: Record<CyclePhase, string> = {
  menstrual: '💧',
  follicular: '🌱',
  ovulatory: '☀️',
  luteal: '🌙',
  unknown: '○',
};

const PHASE_NAMES: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
  unknown: '',
};

interface PhaseInsightCardProps {
  phase: CyclePhase | null;
  dayInCycle: number;
}

export const PhaseInsightCard: React.FC<PhaseInsightCardProps> = ({ phase, dayInCycle }) => {
  const effectivePhase: CyclePhase = phase ?? 'unknown';
  const { phaseSnippet } = useEukiContent(effectivePhase, dayInCycle);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetItem, setSheetItem] = useState<EukiItem | null>(null);

  const accentColor = PHASE_COLORS[effectivePhase];
  const icon = PHASE_ICONS[effectivePhase];
  const phaseName = PHASE_NAMES[effectivePhase];

  const handleReadMore = () => {
    if (phaseSnippet) {
      setSheetItem(phaseSnippet);
      setSheetVisible(true);
    }
  };

  const snippet = phaseSnippet
    ? phaseSnippet.body.slice(0, 180) + (phaseSnippet.body.length > 180 ? '...' : '')
    : 'Learning about your cycle.';

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      <View style={styles.row}>
        <Text style={styles.icon}>{icon}</Text>
        {phaseName ? (
          <Text style={[styles.phaseName, { color: accentColor }]}>{phaseName} Phase · Day {dayInCycle + 1}</Text>
        ) : (
          <Text style={[styles.phaseName, { color: accentColor }]}>Cycle Tracking</Text>
        )}
      </View>
      <Text style={styles.snippet}>{snippet}</Text>
      {phaseSnippet && (
        <TouchableOpacity onPress={handleReadMore} accessibilityRole="button" accessibilityLabel="Read more about this phase">
          <Text style={[styles.readMore, { color: accentColor }]}>Read more →</Text>
        </TouchableOpacity>
      )}
      <ContentSheet
        visible={sheetVisible}
        item={sheetItem}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderLeftWidth: 3,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  phaseName: {
    fontFamily: typography.heading,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1 * 13,
    textTransform: 'uppercase',
  },
  snippet: {
    fontFamily: typography.body,
    fontSize: 14,
    color: '#4A4A4A',
    lineHeight: 20,
    marginBottom: 8,
  },
  readMore: {
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: '500',
  },
});
