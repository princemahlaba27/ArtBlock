import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import {
  deleteSketch,
  formatDuration,
  listSketches,
  sevenDayStreak,
  totalDrawingSeconds,
  type SketchRecord,
} from '../storage/sketchbook';
import { colors, fonts, layout, shadow } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Sketchbook'>;

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function SketchCard({
  sketch,
  onPress,
  onDelete,
}: {
  sketch: SketchRecord;
  onPress: () => void;
  onDelete: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.card}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={sketch.title}
        activeOpacity={0.85}
        onPress={onPress}
      >
        {failed ? (
          <View style={styles.missing}>
            <Text style={styles.missingText}>Photo unavailable</Text>
          </View>
        ) : (
          <Image
            source={{ uri: sketch.photoUri }}
            style={styles.photo}
            resizeMode="cover"
            onError={() => setFailed(true)}
          />
        )}
        <View style={styles.textBlock}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {sketch.title}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {formatWhen(sketch.timestamp)} · {formatDuration(sketch.duration)}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Delete ${sketch.title}`}
        onPress={onDelete}
        style={styles.more}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.ink} />
      </TouchableOpacity>
    </View>
  );
}

export function MySketchbookScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [sketches, setSketches] = useState<SketchRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SketchRecord | null>(null);

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

  const openSketch = (sketch: SketchRecord) => {
    navigation.navigate('Reveal', {
      title: sketch.title,
      id: sketch.id,
      photoUri: sketch.photoUri,
      referenceUri: sketch.referenceUri,
      duration: sketch.duration,
      timestamp: sketch.timestamp,
      seconds: sketch.duration,
    });
  };

  const removeSketch = async (sketch: SketchRecord) => {
    setPendingDelete(null);
    try {
      await deleteSketch(sketch.id);
      setSketches((current) => current.filter((item) => item.id !== sketch.id));
      setError(null);
    } catch {
      setError('Could not delete this drawing.');
    }
  };

  const confirmDelete = (sketch: SketchRecord) => {
    if (Platform.OS === 'web') {
      setPendingDelete(sketch);
      return;
    }
    Alert.alert('Delete Sketch', 'Are you sure you want to permanently delete this sketch?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeSketch(sketch) },
    ]);
  };

  return (
    <View style={styles.screen}>
    <ScrollView style={styles.scroll}
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
        <View style={styles.grid}>
          {sketches.map((sketch) => (
            <View key={sketch.id} style={styles.cell}>
              <SketchCard sketch={sketch} onPress={() => openSketch(sketch)} onDelete={() => confirmDelete(sketch)} />
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
    {pendingDelete ? (
      <View style={styles.confirmLayer}>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Delete Sketch</Text>
          <Text style={styles.confirmBody}>Are you sure you want to permanently delete this sketch?</Text>
          <Pressable accessibilityRole="button" onPress={() => setPendingDelete(null)} style={styles.confirmCancel}>
            <Text style={styles.confirmCancelText}>Cancel</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void removeSketch(pendingDelete)} style={styles.confirmDelete}>
            <Text style={styles.confirmDeleteText}>Delete</Text>
          </Pressable>
        </View>
      </View>
    ) : null}
    </View>
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
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: colors.canvas,
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    flex: 1,
    minHeight: 96,
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  statValue: {
    color: colors.ink,
    fontFamily: fonts.heading,
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
  statLabel: {
    marginTop: 6,
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  status: {
    marginTop: 28,
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  error: {
    color: colors.accent,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  empty: {
    marginTop: 28,
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    padding: 20,
    ...shadow,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.headingBold,
    fontSize: 18,
  },
  emptyBody: {
    marginTop: 8,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    marginHorizontal: -6,
  },
  cell: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    padding: 8,
    ...shadow,
  },
  more: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 17, 24, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    padding: 20,
    ...shadow,
  },
  confirmTitle: {
    color: colors.ink,
    fontFamily: fonts.headingBold,
    fontSize: 18,
    lineHeight: 24,
  },
  confirmBody: {
    marginTop: 8,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  confirmCancel: {
    marginTop: 18,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  confirmCancelText: {
    color: colors.ink,
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  confirmDelete: {
    marginTop: 10,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  confirmDeleteText: {
    color: colors.white,
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.stroke,
  },
  missing: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  missingText: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    textAlign: 'center',
  },
  textBlock: {
    height: 56,
    marginTop: 8,
    overflow: 'hidden',
  },
  cardTitle: {
    height: 36,
    color: colors.ink,
    fontFamily: fonts.headingBold,
    fontSize: 14,
    lineHeight: 18,
  },
  cardMeta: {
    marginTop: 4,
    height: 16,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
});
