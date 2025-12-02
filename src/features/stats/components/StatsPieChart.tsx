// src/features/stats/components/StatsPieChart.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { useAppThemeMode } from '@src/theme';
import { colors } from '@src/theme/colors';

export interface PieDatum {
  key: string;
  label: string;
  value: number;
}

interface StatsPieChartProps {
  data: PieDatum[];
}

/**
 * Animated pie chart with:
 * - Smooth interpolation between previous and next values (slices only)
 * - Stable colours per key from theme-specific chart palettes
 * - Legend values that snap to the real data (no number animation)
 */
const StatsPieChart: React.FC<StatsPieChartProps> = ({ data }) => {
  const theme = useTheme();
  const { mode, themeVariant } = useAppThemeMode();

  const [animatedData, setAnimatedData] = useState<PieDatum[]>(data);
  const prevDataRef = useRef<PieDatum[]>(data);
  const animationFrame = useRef<number | null>(null);

  // Pick the appropriate chart palette based on current mode + variant.
  const chartPalette = useMemo(() => {
    if (themeVariant === 'raspberryLemonade') {
      return mode === 'light'
        ? colors.raspberryLemonade.light.chartPalette
        : colors.raspberryLemonade.dark.chartPalette;
    }

    // Default theme
    return mode === 'light' ? colors.default.light.chartPalette : colors.default.dark.chartPalette;
  }, [mode, themeVariant]);

  // Map from slice key -> colour, kept stable across animations
  const colorMapRef = useRef<Map<string, string>>(new Map());

  // When the palette changes (theme switch), reset the colour map so we can
  // remap keys cleanly into the new palette.
  useEffect(() => {
    colorMapRef.current = new Map();
  }, [chartPalette]);

  const ensureColoursForKeys = (keys: string[]) => {
    const colorMap = colorMapRef.current;
    let usedCount = colorMap.size;

    for (const key of keys) {
      if (!colorMap.has(key)) {
        const paletteLength = chartPalette.length || 1;
        const color = chartPalette[usedCount % paletteLength];
        colorMap.set(key, color);
        usedCount += 1;
      }
    }
  };

  // Animate from previous data to new data whenever `data` changes.
  useEffect(() => {
    const prev = prevDataRef.current;
    const next = data;

    // Union of keys (ensures slices don't "pop" in/out during animation)
    const keySet = new Set<string>();
    for (const d of prev) keySet.add(d.key);
    for (const d of next) keySet.add(d.key);
    const allKeys = Array.from(keySet);

    ensureColoursForKeys(allKeys);

    const prevByKey = new Map(prev.map((d) => [d.key, d]));
    const nextByKey = new Map(next.map((d) => [d.key, d]));

    const duration = 250;
    const start = Date.now();

    if (animationFrame.current != null) {
      cancelAnimationFrame(animationFrame.current);
    }

    const tick = () => {
      const now = Date.now();
      const rawT = (now - start) / duration;
      const tClamped = Math.max(0, Math.min(1, rawT));

      // Simple ease-in-out
      const t = tClamped < 0.5 ? 2 * tClamped * tClamped : -1 + (4 - 2 * tClamped) * tClamped;

      const interpolated: PieDatum[] = allKeys.map((key) => {
        const p = prevByKey.get(key);
        const n = nextByKey.get(key);

        const from = p?.value ?? 0;
        const to = n?.value ?? 0;
        const value = from + (to - from) * t;

        const label = n?.label ?? p?.label ?? key;

        return { key, label, value };
      });

      setAnimatedData(interpolated);

      if (tClamped < 1) {
        animationFrame.current = requestAnimationFrame(tick);
      } else {
        prevDataRef.current = next;
      }
    };

    tick();

    return () => {
      if (animationFrame.current != null) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [data, chartPalette]);

  // Use the *target* data for emptiness + legend (no animated numbers).
  const targetTotal = useMemo(
    () =>
      data.reduce((sum, d) => {
        const v = d.value > 0 ? d.value : 0;
        return sum + v;
      }, 0),
    [data],
  );

  const hasData = data.length > 0 && targetTotal > 0;

  // Total for angles should come from animated data, so the pie morphs smoothly.
  const animatedTotal = animatedData.reduce((sum, d) => {
    const v = d.value > 0 ? d.value : 0;
    return sum + v;
  }, 0);

  const radius = 60;
  const size = radius * 2 + 8;
  const center = size / 2;

  const nonZeroAnimated = animatedData.filter((d) => d.value > 0);
  const isSingleFullSlice = nonZeroAnimated.length === 1 && animatedTotal > 0;

  let currentAngle = -Math.PI / 2; // start at top

  const slices = animatedData.map((d) => {
    const safeValue = d.value > 0 ? d.value : 0;
    const fraction = animatedTotal > 0 ? safeValue / animatedTotal : 0;

    const sliceAngle = fraction * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    if (sliceAngle <= 0) {
      return {
        key: d.key,
        label: d.label,
        value: safeValue,
        hasPath: false,
        pathData: '',
      };
    }

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const startX = center + radius * Math.cos(startAngle);
    const startY = center + radius * Math.sin(startAngle);
    const endX = center + radius * Math.cos(endAngle);
    const endY = center + radius * Math.sin(endAngle);

    const pathData = [
      `M ${center} ${center}`,
      `L ${startX} ${startY}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`,
      'Z',
    ].join(' ');

    return {
      key: d.key,
      label: d.label,
      value: safeValue,
      hasPath: true,
      pathData,
    };
  });

  const colorMap = colorMapRef.current;

  // Legend entries: use the *real* data values, not animated ones.
  const legendEntries = useMemo(() => data.filter((d) => d.value > 0), [data]);

  if (!hasData) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data for this period yet.</Text>
      </View>
    );
  }

  const singleSliceColor =
    isSingleFullSlice && nonZeroAnimated[0]
      ? (colorMap.get(nonZeroAnimated[0].key) ?? theme.colors.primary)
      : undefined;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <G>
          {isSingleFullSlice ? (
            <Circle cx={center} cy={center} r={radius} fill={singleSliceColor} />
          ) : (
            slices.map((slice) => {
              if (!slice.hasPath) return null;
              const color = colorMap.get(slice.key) ?? theme.colors.primary;
              return <Path key={slice.key} d={slice.pathData} fill={color} />;
            })
          )}
        </G>
      </Svg>

      <View style={styles.legend}>
        {legendEntries.map((entry) => {
          const color = colorMap.get(entry.key) ?? theme.colors.primary;
          return (
            <View key={entry.key} style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {entry.label}
              </Text>
              <Text style={styles.legendValue}>{entry.value}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  emptyText: {
    opacity: 0.7,
  },
  legend: {
    marginTop: 12,
    width: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    fontSize: 12,
  },
  legendValue: {
    fontSize: 12,
    marginLeft: 4,
    opacity: 0.85,
  },
});

export default StatsPieChart;
