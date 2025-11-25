// src/features/stats/components/ReadingByTypeChart.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text } from 'react-native-paper';
import type { TypeStats } from '../services/statsService';

interface Props {
  data: TypeStats[];
}

const ReadingByTypeChart: React.FC<Props> = ({ data }) => {
  if (data.length === 0) {
    return <Text>No type data yet.</Text>;
  }

  const total = data.reduce((acc, d) => acc + d.count, 0) || 1;

  return (
    <View>
      {data.map((item) => (
        <View key={item.type} style={styles.row}>
          <Text style={styles.label}>{item.type === 'book' ? 'Books' : 'Fanfics'}</Text>
          <ProgressBar progress={item.count / total} style={styles.bar} />
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

export default ReadingByTypeChart;
