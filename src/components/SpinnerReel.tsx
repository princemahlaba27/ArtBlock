import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { pieceSvg, type StencilPiece } from '../data/rouletteData';
import { colors, layout } from '../theme/colors';

const ITEM_HEIGHT = 108;
const COPIES = 8;

type SpinnerReelProps = {
  label: string;
  viewBox: string;
  items: StencilPiece[];
  reelIndex: number;
  selectedIndex: number;
  locked: boolean;
  spinNonce: number;
  onToggleLock: (reelIndex: number) => void;
  onSettled: (reelIndex: number, index: number) => void;
  onBusy: (reelIndex: number, busy: boolean) => void;
};

export function SpinnerReel({
  label,
  viewBox,
  items,
  reelIndex,
  selectedIndex,
  locked,
  spinNonce,
  onToggleLock,
  onSettled,
  onBusy,
}: SpinnerReelProps) {
  const [shown, setShown] = useState(selectedIndex);
  const position = useSharedValue(selectedIndex);
  const selectedRef = useRef(selectedIndex);
  selectedRef.current = selectedIndex;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const tick = useCallback((index: number) => {
    setShown((current) => (current === index ? current : index));
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);

  useAnimatedReaction(
    () => Math.round(position.value),
    (current, previous) => {
      if (previous == null || current === previous) return;
      const length = items.length;
      const index = ((current % length) + length) % length;
      scheduleOnRN(tick, index);
    },
    [tick, items.length],
  );

  useEffect(() => {
    if (!locked) return;
    cancelAnimation(position);
    const length = items.length;
    const snapped = Math.round(position.value);
    position.value = snapped;
    const index = ((snapped % length) + length) % length;
    setShown(index);
    onSettled(reelIndex, index);
    onBusy(reelIndex, false);
  }, [locked, items.length, onBusy, onSettled, position, reelIndex]);

  useEffect(() => {
    if (spinNonce === 0 || lockedRef.current) return;
    const length = items.length;
    let start = position.value;
    const maxSafe = length * (COPIES - 4);
    if (start > maxSafe) {
      const laps = Math.floor(start / length) - 1;
      if (laps > 0) {
        start -= laps * length;
        position.value = start;
      }
    }
    const currentMod = ((Math.round(start) % length) + length) % length;
    let delta = selectedRef.current - currentMod;
    if (delta <= 0) delta += length;
    delta += length * 2;
    const duration = 1200 + reelIndex * 220;
    onBusy(reelIndex, true);
    position.value = withTiming(
      start + delta,
      {
        duration,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        'worklet';
        if (finished) scheduleOnRN(onBusy, reelIndex, false);
      },
    );
    const timer = setTimeout(() => onBusy(reelIndex, false), duration + 150);
    return () => clearTimeout(timer);
  }, [spinNonce, items.length, onBusy, position, reelIndex]);

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -position.value * ITEM_HEIGHT }],
  }));

  const strip: { key: string; item: StencilPiece }[] = [];
  for (let copy = 0; copy < COPIES; copy += 1) {
    items.forEach((item) => {
      strip.push({ key: `${copy}-${item.id}`, item });
    });
  }

  const current = items[shown] ?? items[0];

  return (
    <View style={[styles.reel, locked && styles.reelLocked]}>
      <Text style={styles.category} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.window}>
        <Animated.View style={stripStyle}>
          {strip.map(({ key, item }) => (
            <View key={key} style={styles.cell}>
              <SvgXml xml={pieceSvg(item.paths, viewBox)} width={64} height={64} />
            </View>
          ))}
        </Animated.View>
      </View>
      <Text style={styles.itemLabel} numberOfLines={2}>
        {current.label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={locked ? `Unlock ${label}` : `Lock ${label}`}
        onPress={() => onToggleLock(reelIndex)}
        style={({ pressed }) => [
          styles.lock,
          locked && styles.lockOn,
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[styles.lockText, locked && styles.lockTextOn]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {locked ? 'Unlock' : 'Lock'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  reel: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  reelLocked: {
    borderColor: colors.accent,
  },
  category: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 6,
  },
  window: {
    height: ITEM_HEIGHT,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: colors.canvas,
  },
  cell: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    minHeight: 32,
    marginTop: 8,
    textAlign: 'center',
    color: colors.ink,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  lock: {
    marginTop: 6,
    minHeight: 32,
    width: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingHorizontal: 4,
  },
  lockOn: {
    backgroundColor: colors.canvas,
    borderColor: colors.accent,
  },
  lockText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  lockTextOn: {
    color: colors.accent,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
});
