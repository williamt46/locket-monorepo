import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { phaseColor, phaseTint } from '../theme/colors';
import { font } from '../theme/typography';
import { useEukiContent } from '../hooks/useEukiContent';
import { ContentSheet } from './ContentSheet';
import type { CyclePhase } from '../utils/PredictionEngine';
import type { HealthItem } from '@locket/shared';

const PHASE_ICON_NAMES: Record<CyclePhase, React.ComponentProps<typeof MaterialIcons>['name']> = {
  menstrual:  'water-drop',
  follicular: 'spa',
  ovulatory:  'wb-sunny',
  luteal:     'mode-night',
  unknown:    'radio-button-unchecked',
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
  const { t } = useTheme();
  const effectivePhase: CyclePhase = phase ?? 'unknown';
  const { phaseSnippet } = useEukiContent(effectivePhase, dayInCycle);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetItem, setSheetItem] = useState<HealthItem | null>(null);

  const accentColor    = phaseColor(t, effectivePhase);
  const phaseTintColor = phaseTint(t, effectivePhase);
  const phaseName      = PHASE_NAMES[effectivePhase];

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
    <View style={[styles.card, { backgroundColor: phaseTintColor, shadowColor: t.shadowColor, shadowOpacity: t.shadowOpacity }]}>
      <View style={styles.row}>
        <MaterialIcons name={PHASE_ICON_NAMES[effectivePhase]} size={16} color={accentColor} />
        {phaseName ? (
          <Text style={[styles.phaseName, { color: accentColor }]}>{phaseName} Phase · Day {dayInCycle + 1}</Text>
        ) : (
          <Text style={[styles.phaseName, { color: accentColor }]}>Cycle Tracking</Text>
        )}
      </View>
      <Text style={[styles.snippet, { color: t.graphite }]}>{snippet}</Text>
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
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  phaseName: {
    fontFamily: font(700),
    fontSize: 13,
    letterSpacing: 0.1 * 13,
    textTransform: 'uppercase',
  },
  snippet: {
    fontFamily: font(400),
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  readMore: {
    fontFamily: font(500),
    fontSize: 14,
  },
});
