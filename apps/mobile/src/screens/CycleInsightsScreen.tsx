import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { PhaseInsightCard } from '../components/PhaseInsightCard';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export const CycleInsightsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const { currentPhase, dayInCycle, cycleStats } = route.params ?? {};

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cycle Insights</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <PhaseInsightCard phase={currentPhase ?? null} dayInCycle={dayInCycle ?? 0} />

        {cycleStats && Object.keys(cycleStats).length > 0 && (
          <View style={styles.statsCard}>
            <Text style={styles.statsHeader}>CYCLE HISTORY</Text>
            {Object.entries(cycleStats as Record<string, number>)
              .sort(([a], [b]) => Number(b) - Number(a))
              .slice(0, 3)
              .map(([year, avg]) => (
                <View key={year} style={styles.statsRow}>
                  <Text style={styles.statsYear}>{year}</Text>
                  <Text style={styles.statsAvg}>{avg} day avg cycle</Text>
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FDFBF9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
    backgroundColor: 'rgba(253,251,249,0.9)',
  },
  backBtn: {
    fontFamily: typography.body,
    fontSize: 16,
    color: colors.locketBlue,
    width: 80,
  },
  backBtnPlaceholder: {
    width: 80,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.heading,
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  content: {
    paddingTop: 20,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsHeader: {
    fontFamily: typography.heading,
    fontSize: 13,
    fontWeight: '700',
    color: colors.locketBlue,
    letterSpacing: 0.1 * 13,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  statsYear: {
    fontFamily: typography.body,
    fontSize: 14,
    color: '#4A4A4A',
    fontWeight: '500',
  },
  statsAvg: {
    fontFamily: typography.body,
    fontSize: 14,
    color: '#8E8E93',
  },
});
