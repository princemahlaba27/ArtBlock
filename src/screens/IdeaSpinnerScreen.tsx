import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useCameraPermissions } from 'expo-camera';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PermissionPrimer } from '../components/PermissionPrimer';
import { SpinnerReel } from '../components/SpinnerReel';
import { reels, stencilTitle } from '../data/rouletteData';
import type { RootStackParamList, TraceParams } from '../navigation/types';
import { isPaywallPassed, markTrackingAsked, shouldAskTracking } from '../storage/preferences';
import { colors, layout } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Ideas'>;

function differentIndex(length: number, current: number): number {
  if (length <= 1) return current;
  let next = current;
  while (next === current) {
    next = Math.floor(Math.random() * length);
  }
  return next;
}

export function IdeaSpinnerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [indices, setIndices] = useState([0, 0, 2, 1]);
  const [locked, setLocked] = useState(() => reels.map(() => false));
  const [busy, setBusy] = useState(() => reels.map(() => false));
  const [spinNonce, setSpinNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [cameraPrimer, setCameraPrimer] = useState(false);
  const [trackingPrimer, setTrackingPrimer] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void shouldAskTracking().then((ask) => {
        if (active && ask) setTrackingPrimer(true);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const spinning = busy.some(Boolean);
  const pieces = reels.map((reel, index) => reel.items[indices[index]] ?? reel.items[0]);
  const title = stencilTitle(pieces[0], pieces[1], pieces[2], pieces[3]);

  const onBusy = useCallback((reelIndex: number, value: boolean) => {
    setBusy((current) => {
      if (current[reelIndex] === value) return current;
      const next = [...current];
      next[reelIndex] = value;
      return next;
    });
  }, []);

  const onSettled = useCallback((reelIndex: number, index: number) => {
    setIndices((current) => {
      if (current[reelIndex] === index) return current;
      const next = [...current];
      next[reelIndex] = index;
      return next;
    });
  }, []);

  const toggleLock = (reelIndex: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setLocked((current) => current.map((value, index) => (index === reelIndex ? !value : value)));
  };

  const spinAll = () => {
    if (locked.every(Boolean)) {
      setNotice('Unlock a reel to spin it.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      return;
    }
    setNotice(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setIndices((current) =>
      current.map((value, index) =>
        locked[index] ? value : differentIndex(reels[index].items.length, value),
      ),
    );
    setSpinNonce((value) => value + 1);
  };

  const traceParams = (): TraceParams => ({
    title,
    subjectId: pieces[0].id,
    plantId: pieces[1].id,
    frameId: pieces[2].id,
    quoteId: pieces[3].id,
  });

  const openTrace = () => {
    navigation.navigate('Trace', traceParams());
  };

  const startTracing = async () => {
    if (spinning) return;
    setNotice(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    const passed = await isPaywallPassed();
    if (!passed) {
      navigation.navigate('Paywall', traceParams());
      return;
    }
    if (permission?.granted) {
      openTrace();
      return;
    }
    setCameraPrimer(true);
  };

  const confirmCamera = async () => {
    setCameraPrimer(false);
    try {
      await requestPermission();
    } catch {
      setNotice('The camera permission did not come through. Try again.');
      return;
    }
    openTrace();
  };

  const confirmTracking = async () => {
    setTrackingPrimer(false);
    await markTrackingAsked();
    if (Platform.OS === 'ios') {
      try {
        await requestTrackingPermissionsAsync();
      } catch {
        // Tracing still works if the system dialog does not appear.
      }
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.lead}>Mix a subject, a plant, a frame, and a few words.</Text>
      <Text style={styles.support}>Lock anything you want to keep, then spin the rest.</Text>

      <View style={styles.row}>
        {reels.map((reel, index) => (
          <SpinnerReel
            key={reel.key}
            label={reel.label}
            viewBox={reel.viewBox}
            items={reel.items}
            reelIndex={index}
            selectedIndex={indices[index] ?? 0}
            locked={locked[index] ?? false}
            spinNonce={spinNonce}
            onToggleLock={toggleLock}
            onSettled={onSettled}
            onBusy={onBusy}
          />
        ))}
      </View>

      <Text style={styles.combo}>{title}</Text>

      {notice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={spinAll}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryText}>Spin All Ideas</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={spinning}
        onPress={() => void startTracing()}
        style={({ pressed }) => [
          styles.primary,
          spinning && styles.disabled,
          pressed && !spinning && styles.pressed,
        ]}
      >
        <Text style={styles.primaryText}>{spinning ? 'Reels are spinning…' : 'Start Tracing'}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Sketchbook')}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      >
        <Text style={styles.linkText}>My Sketchbook</Text>
      </Pressable>
      <PermissionPrimer
        visible={cameraPrimer}
        title="Line art on your paper"
        body="ArtBlock uses your camera to project this line art directly onto your paper. Rest the phone on a glass so your hands can draw underneath."
        onConfirm={() => void confirmCamera()}
        onDismiss={() => setCameraPrimer(false)}
      />
      <PermissionPrimer
        visible={trackingPrimer}
        title="Ideas that fit you"
        body="This helps ArtBlock suggest drawing ideas and keep free sketch pages up to date. Tracing still works if you skip it."
        confirmLabel="Continue"
        onConfirm={() => void confirmTracking()}
        onDismiss={() => {
          setTrackingPrimer(false);
          void markTrackingAsked();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: colors.canvas,
  },
  lead: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.ink,
  },
  support: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  combo: {
    marginTop: 16,
    textAlign: 'center',
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  notice: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 14,
  },
  noticeText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  settings: {
    marginTop: 8,
    color: colors.brand,
    fontSize: 15,
    fontWeight: '700',
  },
  secondary: {
    marginTop: 20,
    height: layout.pillHeight,
    borderRadius: layout.pillRadius,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  secondaryText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  primary: {
    marginTop: 12,
    height: layout.pillHeight,
    borderRadius: layout.pillRadius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  primaryText: {
    color: colors.canvas,
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
  link: {
    marginTop: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
});
