import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  formatDuration,
  listSketches,
  sevenDayStreak,
  sketchPhotoUri,
  totalDrawingSeconds,
  type SketchRecord,
} from '../storage/sketchbook';
import { colors, layout } from '../theme/colors';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function SketchCard({ sketch, height }: { sketch: SketchRecord; height: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.card}>
      {failed ? (
        <View style={[styles.missing, { height }]}>
          <Text style={styles.missingText}>Photo unavailable</Text>
        </View>
      ) : (
        <Image
          source={{ uri: sketchPhotoUri(sketch.photoFilename) }}
          style={[styles.photo, { height }]}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      )}
      <Text style={styles.cardTitle} numberOfLines={2}>
        {sketch.title}
      </Text>
      <Text style={styles.cardMeta}>
        {formatWhen(sketch.date)} · {formatDuration(sketch.seconds)}
      </Text>
    </View>
  );
}

export function MySketchbookScreen() {
  const insets = useSafeAreaInsets();
  const [sketches, setSketches] = useState<SketchRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listSketches()
        .then((next) => {
          if (!active) return;
          setSketches(next);
          setError(null);
        })
        .catch(() => {
          if (!active) return;
          setError('Could not open your sketchbook.');
        })
        .finally(() => {
          if (active) setLoaded(true);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const left = sketches.filter((_, index) => index % 2 === 0);
  const right = sketches.filter((_, index) => index % 2 === 1);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stats}>
        <Stat value={String(sketches.length)} label="Total Drawings" />
        <Stat value={formatDuration(totalDrawingSeconds(sketches))} label="Time Spent Drawing" />
        <Stat value={String(sevenDayStreak(sketches))} label="7-Day Streak" />
      </View>

      {!loaded ? (
        <View style={styles.status}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.statusText}>Opening your drawings…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.status}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      {loaded && !error && sketches.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No drawings yet</Text>
          <Text style={styles.emptyBody}>
            Spin an idea, trace it on paper, and the photo will land here.
          </Text>
        </View>
      ) : null}

      {loaded && !error && sketches.length > 0 ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            {left.map((sketch, index) => (
              <SketchCard key={sketch.id} sketch={sketch} height={index % 2 === 0 ? 220 : 160} />
            ))}
          </View>
          <View style={styles.column}>
            {right.map((sketch, index) => (
              <SketchCard key={sketch.id} sketch={sketch} height={index % 2 === 0 ? 160 : 220} />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={2}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: colors.canvas,
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    minHeight: 96,
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabel: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  status: {
    marginTop: 28,
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    color: colors.muted,
    fontSize: 15,
  },
  error: {
    color: colors.accent,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  empty: {
    marginTop: 28,
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 20,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyBody: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  columns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  column: {
    flex: 1,
    gap: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 8,
  },
  photo: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: colors.stroke,
  },
  missing: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  missingText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  cardTitle: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  cardMeta: {
    marginTop: 4,
    marginBottom: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
});
