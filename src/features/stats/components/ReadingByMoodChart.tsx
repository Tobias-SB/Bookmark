// src/features/stats/components/ReadingByMoodChart.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text } from 'react-native-paper';
import type { MoodStats } from '../services/statsService';

interface Props {
  data: MoodStats[];
}

const ReadingByMoodChart: React.FC<Props> = ({ data }) => {
  if (data.length === 0) {
    return <Text>No mood data yet.</Text>;
  }

  const max = Math.max(...data.map((d) => d.count));

  return (
    <View>
      {data.map((item) => (
        <View key={item.moodTag} style={styles.row}>
          <Text style={styles.label}>{item.moodTag.replace('-', ' ')}</Text>
          <ProgressBar progress={item.count / max} style={styles.bar} />
          <Text style={styles.count}>{item.count}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    marginBottom: 8,
  },
  label: {
    marginBottom: 2,
  },
  bar: {
    height: 6,
    borderRadius: 3,
  },
  count: {
    marginTop: 2,
    fontSize: 12,
  },
});

export default ReadingByMoodChart;
