import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { usePostHog } from 'posthog-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, SvgXml } from 'react-native-svg';
import Slider from '@react-native-community/slider';

import { logEvent } from '../analytics/logEvent';
import { LeavingAlreadySheet, type LeaveReason } from '../components/LeavingAlreadySheet';
import { PermissionPrimer } from '../components/PermissionPrimer';
import {
  composeStencil,
  lineModes,
  pieceById,
  reels,
  type LineMode,
} from '../data/rouletteData';
import type { RootStackParamList } from '../navigation/types';
import { askNotificationPermission, scheduleReminder } from '../permissions/reminders';
import { listSketches } from '../storage/sketchbook';
import { saveDrawLater } from '../storage/preferences';
import { colors, layout } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Trace'>;

const SIMULATOR_PHOTO_URI = 'simulator://artblock/drawing-placeholder';

function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M6 6 L18 18 M18 6 L6 18" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function LightIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M12 3 V6 M12 18 V21 M4.9 4.9 L7 7 M17 17 L19.1 19.1 M3 12 H6 M18 12 H21 M4.9 19.1 L7 17 M17 7 L19.1 4.9"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M9 14c0-3 1.2-5 3-7 1.8 2 3 4 3 7a3 3 0 0 1-6 0Z"
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />
    </Svg>
  );
}

function LockIcon({ color, closed }: { color: string; closed: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d={closed ? 'M8 11 V8 a4 4 0 0 1 8 0 V11' : 'M8 11 V8 a4 4 0 0 1 7.2-2.4'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M7 11 H17 V19 a2 2 0 0 1-2 2 H9 a2 2 0 0 1-2-2 Z"
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />
    </Svg>
  );
}

export function ARCameraTraceScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const isSimulator = !Device.isDevice;
  const posthog = usePostHog();
  const { width, height } = useWindowDimensions();
  const cameraRef = useRef<CameraView>(null);
  const startedAt = useRef(Date.now());
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(isSimulator);
  const [torchOn, setTorchOn] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [opacity, setOpacity] = useState(0.45);
  const [lineMode, setLineMode] = useState<LineMode>('normal');
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [badgeLine, setBadgeLine] = useState('Day 1 Complete • Novice Badge Earned');
  const [leaving, setLeaving] = useState(false);
  const [guide, setGuide] = useState(false);
  const [ghost, setGhost] = useState(false);
  const [focusLocked, setFocusLocked] = useState(true);
  const [remindPrimer, setRemindPrimer] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setCapturing(false);
      if (!Device.isDevice) setCameraReady(true);
      return () => {
        if (Device.isDevice) setCameraReady(false);
      };
    }, []),
  );

  const stencilWidth = Math.min(width * 0.82, 340);
  const stencilHeight = Math.min(height * 0.56, 500);

  const svg = useMemo(() => {
    const subject = pieceById(reels[0].items, route.params.subjectId);
    const plant = pieceById(reels[1].items, route.params.plantId);
    const frame = pieceById(reels[2].items, route.params.frameId);
    const quote = pieceById(reels[3].items, route.params.quoteId);
    return composeStencil(subject, plant, frame, quote, lineMode);
  }, [lineMode, route.params.frameId, route.params.plantId, route.params.quoteId, route.params.subjectId]);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const savedRotation = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .enabled(!isLocked)
    .onUpdate((event) => {
      const next = savedScale.value * event.scale;
      scale.value = Math.min(3.2, Math.max(0.45, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const rotate = Gesture.Rotation()
    .enabled(!isLocked)
    .onUpdate((event) => {
      rotation.value = savedRotation.value + event.rotation;
    })
    .onEnd(() => {
      savedRotation.value = rotation.value;
    });

  const drag = Gesture.Pan()
    .enabled(!isLocked)
    .onUpdate((event) => {
      translateX.value = Math.min(180, Math.max(-180, savedX.value + event.translationX));
      translateY.value = Math.min(220, Math.max(-220, savedY.value + event.translationY));
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const gesture = Gesture.Simultaneous(pinch, rotate, drag);

  const stencilStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}rad` },
      { scale: scale.value },
    ],
  }));

  const finish = async () => {
    if ((!isSimulator && !cameraReady) || capturing || celebrating) return;
    setError(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    try {
      const saved = await listSketches();
      setBadgeLine(
        saved.length === 0
          ? 'Day 1 Complete • Novice Badge Earned'
          : `${saved.length + 1} drawings done`,
      );
    } catch {
      setBadgeLine('Day 1 Complete • Novice Badge Earned');
    }
    setCelebrating(true);
  };

  const snapDrawing = async () => {
    if (capturing) return;
    if (!isSimulator && (!cameraRef.current || !cameraReady)) return;
    setError(null);
    setCapturing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    const seconds = Math.max(0, Math.round((Date.now() - startedAt.current) / 1000));
    if (isSimulator) {
      navigation.navigate('Reveal', {
        title: route.params.title,
        svg,
        photoUri: SIMULATOR_PHOTO_URI,
        seconds,
      });
      return;
    }
    const camera = cameraRef.current;
    if (!camera) {
      setCapturing(false);
      return;
    }
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTimeout(resolve, 80));
      });
    });
    try {
      const photo = await camera.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) throw new Error('The photo did not save.');
      navigation.navigate('Reveal', {
        title: route.params.title,
        svg,
        photoUri: photo.uri,
        seconds,
      });
    } catch {
      setCapturing(false);
      setError('The photo did not save. Hold still and tap Snap your drawing again.');
    }
  };

  const applyLeave = (reason: LeaveReason) => {
    setLeaving(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    logEvent(posthog, 'trace_exit_friction_logged', {
      reason_code: reason,
      intervention_ran: true,
      pencil_time_seconds: Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)),
    });
    if (reason === 'no_paper') {
      void saveDrawLater({
        title: route.params.title,
        subjectId: route.params.subjectId,
        plantId: route.params.plantId,
        frameId: route.params.frameId,
        quoteId: route.params.quoteId,
      });
      setRemindPrimer(true);
      return;
    }
    if (reason === 'confused') {
      setGuide(true);
      return;
    }
    if (reason === 'tricky') {
      setLineMode('ink');
      setError(null);
      return;
    }
    if (reason === 'dark') {
      if (Device.isDevice) setTorchOn(true);
      setLineMode('neon');
      return;
    }
    setIsLocked(true);
    setOpacity(0.28);
    setFocusLocked(false);
    setGhost(true);
  };

  const confirmDeskReminder = async () => {
    setRemindPrimer(false);
    const granted = await askNotificationPermission();
    if (granted) {
      await scheduleReminder({
        seconds: 3 * 60 * 60,
        title: 'Your drawing is waiting',
        body: 'The idea you saved is ready when you have paper.',
      });
    }
    navigation.goBack();
  };

  if (!isSimulator && !permission) {
    return (
      <View style={styles.permission}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!isSimulator && permission && !permission.granted) {
    return (
      <View style={styles.permission}>
        <Text style={styles.permissionTitle}>Camera needed</Text>
        <Text style={styles.permissionBody}>
          ArtBlock uses your camera to place line art on your paper so you can trace it.
        </Text>
        {permission.canAskAgain ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void requestPermission()}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Allow Camera</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openSettings()}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Open Settings</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.link}>
          <Text style={styles.linkText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const showStencil = !capturing;
  const readyToFinish = isSimulator || cameraReady;

  return (
    <View style={styles.root}>
      {isSimulator ? (
        <View style={styles.simulatorFeed}>
          <Text style={styles.simulatorLabel}>Camera Feed (Simulator Mode)</Text>
        </View>
      ) : isFocused ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torchOn}
          // SDK 57: "on" focuses once and then locks. "off" lets the lens look again.
          autofocus={focusLocked ? 'on' : 'off'}
          mode="picture"
          onCameraReady={() => setCameraReady(true)}
          onMountError={(event) => setError(event.message || 'The camera could not start.')}
        />
      ) : (
        <View style={styles.cameraFallback} />
      )}

      {showStencil ? (
        <GestureDetector gesture={gesture}>
          <View
            pointerEvents={isLocked ? 'none' : 'auto'}
            style={styles.gestureLayer}
            collapsable={false}
          >
            <Animated.View pointerEvents="none" style={[styles.stencil, stencilStyle, { opacity }]}>
              <SvgXml xml={svg} width={stencilWidth} height={stencilHeight} />
            </Animated.View>
          </View>
        </GestureDetector>
      ) : null}

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave tracing"
            disabled={capturing}
            onPress={() => setLeaving(true)}
            style={[styles.circle, capturing && styles.disabled]}
          >
            <CloseIcon color={colors.canvas} />
          </Pressable>
          <View style={styles.topRight} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={torchOn ? 'Turn light off' : 'Turn light on'}
              onPress={() => {
                if (!Device.isDevice) return;
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                setTorchOn((value) => !value);
              }}
              style={[styles.circle, torchOn && styles.circleOn]}
            >
              <LightIcon color={torchOn ? colors.ink : colors.canvas} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isLocked ? 'Unlock the lines' : 'Lock the lines'}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
                setIsLocked((value) => !value);
              }}
              style={[styles.circle, isLocked && styles.circleLocked]}
            >
              <LockIcon color={isLocked ? colors.accent : colors.canvas} closed={isLocked} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.dock, { marginBottom: Math.max(insets.bottom, 16) }]}>
          {capturing ? <Text style={styles.hint}>Taking the photo…</Text> : null}
          {ghost ? <Text style={styles.hint}>Line the page back up with the faint lines.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.hint}>
            {isLocked
              ? 'Lines are locked. Draw on your paper.'
              : 'Pinch, turn, or drag the lines. Then lock them.'}
          </Text>
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Lines</Text>
            <Slider
              style={styles.slider}
              minimumValue={0.05}
              maximumValue={1}
              value={opacity}
              onValueChange={setOpacity}
              minimumTrackTintColor={colors.brand}
              maximumTrackTintColor={colors.stroke}
              thumbTintColor={colors.canvas}
              accessibilityLabel="Line opacity"
            />
            <Text style={styles.percent}>{Math.round(opacity * 100)}%</Text>
          </View>
          <View style={styles.modes}>
            {lineModes.map((mode) => {
              const selected = mode.id === lineMode;
              return (
                <Pressable
                  key={mode.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                    setLineMode(mode.id);
                  }}
                  style={[styles.mode, selected && styles.modeOn]}
                >
                  <Text style={[styles.modeText, selected && styles.modeTextOn]}>{mode.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {ghost ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setFocusLocked(true);
                setGhost(false);
                setOpacity(0.45);
              }}
              style={({ pressed }) => [styles.finish, pressed && styles.pressed]}
            >
              <Text style={styles.finishText}>Lock focus again</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={!readyToFinish || capturing || celebrating}
              onPress={() => void finish()}
              style={({ pressed }) => [
                styles.finish,
                (!readyToFinish || capturing || celebrating) && styles.disabled,
                pressed && readyToFinish && !capturing && !celebrating && styles.pressed,
              ]}
            >
              <Text style={styles.finishText}>
                {readyToFinish ? 'Finish Drawing' : 'Starting camera…'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {celebrating ? (
        <View style={styles.celebrateWrap}>
          <View style={styles.celebrateCard}>
            <Text style={styles.celebrateTitle}>{badgeLine}</Text>
            <Text style={styles.celebrateBody}>
              Snap a photo of the drawing on your paper. It goes in My Sketchbook.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={!readyToFinish || capturing}
              onPress={() => void snapDrawing()}
              style={({ pressed }) => [
                styles.primary,
                (!readyToFinish || capturing) && styles.disabled,
                pressed && readyToFinish && !capturing && styles.pressed,
              ]}
            >
              <Text style={styles.primaryText}>{capturing ? 'Snapping…' : 'Snap your drawing'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setCelebrating(false)} style={styles.link}>
              <Text style={styles.linkText}>Keep drawing</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {guide ? (
        <View style={styles.celebrateWrap}>
          <View style={styles.celebrateCard}>
            <Text style={styles.celebrateTitle}>Phone on a glass</Text>
            <Text style={styles.celebrateBody}>
              Set a glass on the paper and rest the phone on top, camera facing down. Your hands
              draw underneath the lines.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setGuide(false)}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>Back to the lines</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <LeavingAlreadySheet visible={leaving} onClose={() => setLeaving(false)} onSelect={applyLeave} />
      <PermissionPrimer
        visible={remindPrimer}
        title="Remind you in 3 hours?"
        body="This idea is saved for later. ArtBlock can send one note when it’s time to draw."
        confirmLabel="Remind me"
        onConfirm={() => void confirmDeskReminder()}
        onDismiss={() => {
          setRemindPrimer(false);
          navigation.goBack();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraFallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  simulatorFeed: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#3A3A3F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulatorLabel: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '600',
  },
  gestureLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 150,
  },
  stencil: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topRight: {
    flexDirection: 'row',
    gap: 12,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.hud,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOn: {
    backgroundColor: colors.canvas,
  },
  circleLocked: {
    backgroundColor: colors.canvas,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  dock: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    borderRadius: layout.cardRadius,
    backgroundColor: colors.hud,
    padding: 16,
  },
  hint: {
    color: colors.canvas,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  error: {
    color: colors.accent,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    width: 40,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  percent: {
    color: colors.canvas,
    fontSize: 13,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
  modes: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  mode: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  modeOn: {
    backgroundColor: colors.canvas,
  },
  modeText: {
    color: colors.canvas,
    fontSize: 14,
    fontWeight: '700',
  },
  modeTextOn: {
    color: colors.ink,
  },
  finish: {
    height: layout.pillHeight,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishText: {
    color: colors.canvas,
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  celebrateWrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: 'rgba(30, 30, 36, 0.28)',
  },
  celebrateCard: {
    backgroundColor: colors.canvas,
    borderRadius: layout.cardRadius,
    padding: 20,
  },
  celebrateTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.ink,
  },
  celebrateBody: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  permission: {
    flex: 1,
    backgroundColor: colors.canvas,
    padding: 24,
    justifyContent: 'center',
  },
  permissionTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  permissionBody: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  primary: {
    marginTop: 24,
    height: layout.pillHeight,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: colors.canvas,
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    marginTop: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: '700',
  },
});
