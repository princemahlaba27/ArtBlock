import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { FeColorMatrix, Filter, Image as SvgImage, Path, SvgXml } from 'react-native-svg';
import Slider from '@react-native-community/slider';

import { type LineMode } from '../data/rouletteData';
import type { RootStackParamList } from '../navigation/types';
import { toLineArt } from '../runtime/lineArt';
import { isPreviewDevice } from '../runtime/previewDevice';
import { listSketches } from '../storage/sketchbook';
import { markFreeTraceUsed } from '../storage/preferences';
import { buttonShadow, colors, fonts, layout, shadow } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Trace'>;

const SIMULATOR_PHOTO_URI = 'simulator://artblock/drawing-placeholder';
const INK_EDGE = '#111118';
const NEON_EDGE = '#00E5FF';
const TRACE_MODES: { id: LineMode; label: string }[] = [
  { id: 'normal', label: 'Photo' },
  { id: 'ink', label: 'Ink' },
  { id: 'neon', label: 'Neon' },
];
const GRAY_CONTRAST = [
  0.658, 1.291, 0.251, 0, -0.55, 0.658, 1.291, 0.251, 0, -0.55, 0.658, 1.291, 0.251, 0, -0.55, 0, 0, 0, 1,
  0,
];

function OutlinePhoto({
  uri,
  width,
  height,
  filterId,
}: {
  uri: string;
  width: number;
  height: number;
  filterId: string;
}) {
  return (
    <Svg width={width} height={height}>
      <Filter id={filterId}>
        <FeColorMatrix type="matrix" values={GRAY_CONTRAST} />
      </Filter>
      <SvgImage
        href={{ uri }}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        filter={`url(#${filterId})`}
      />
    </Svg>
  );
}

function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M6 6 L18 18 M18 6 L6 18" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
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
  const isSimulator = isPreviewDevice();
  const { width, height } = useWindowDimensions();
  const cameraRef = useRef<CameraView>(null);
  const startedAt = useRef(Date.now());
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(isSimulator);
  const [flashMode, setFlashMode] = useState<'torch' | 'off'>('off');
  const [isLocked, setIsLocked] = useState(false);
  const [opacity, setOpacity] = useState(0.45);
  const [lineMode, setLineMode] = useState<LineMode>('normal');
  const [lineArt, setLineArt] = useState<Record<string, string>>({});
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [badgeLine, setBadgeLine] = useState('Day 1 Complete • Novice Badge Earned');
  const [exitAsk, setExitAsk] = useState(false);
  const [focusLocked] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setCapturing(false);
      if (isPreviewDevice()) setCameraReady(true);
      return () => {
        if (!isPreviewDevice()) setCameraReady(false);
      };
    }, []),
  );

  const showingHud = isSimulator || Boolean(permission?.granted);

  useEffect(() => {
    if (!showingHud) return;
    void markFreeTraceUsed();
  }, [showingHud]);

  const referenceUris = useMemo(() => {
    const slots = (route.params.slots ?? []).filter((uri): uri is string => Boolean(uri));
    const all = route.params.imageUri ? [route.params.imageUri, ...slots] : slots;
    return [...new Set(all)];
  }, [route.params.imageUri, route.params.slots]);

  useEffect(() => {
    if (Platform.OS !== 'web' || referenceUris.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        referenceUris.flatMap((uri) =>
          [INK_EDGE, NEON_EDGE].map(async (edge) => {
            const art = await toLineArt(uri, edge);
            return [`${edge}|${uri}`, art] as const;
          }),
        ),
      );
      if (!cancelled) setLineArt(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [referenceUris]);

  const stencilWidth = Math.min(width * 0.82, 340);
  const stencilHeight = Math.min(height * 0.56, 500);

  const svg = useMemo(() => {
    const ink = lineMode === 'neon' ? '#00E5FF' : '#111118';
    const lines = (route.params.prompts ?? []).map((prompt, index) => {
      const safe = prompt.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return `<text x="28" y="${78 + index * 78}" font-size="26" fill="${ink}">${safe}</text>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 420">${lines.join('')}</svg>`;
  }, [lineMode, route.params.prompts]);

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
    const openReveal = (photoUri: string) => {
      navigation.reset({
        index: 1,
        routes: [
          { name: 'Studio' },
          { name: 'Reveal', params: { title: route.params.title, svg, photoUri, seconds } },
        ],
      });
    };
    if (isSimulator) {
      openReveal(SIMULATOR_PHOTO_URI);
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
      openReveal(photo.uri);
    } catch {
      setCapturing(false);
      setError('The photo did not save. Hold still and tap Snap your drawing again.');
    }
  };

  const confirmExit = () => {
    if (Platform.OS === 'web') {
      setExitAsk(true);
      return;
    }
    Alert.alert('Exit Drawing?', 'Your current tracing progress will be closed.', [
      { text: 'Keep Drawing', style: 'cancel' },
      { text: 'Exit', style: 'destructive', onPress: () => navigation.navigate('Studio') },
    ]);
  };

  const shownUri = (uri: string) => {
    if (lineMode === 'normal' || Platform.OS !== 'web') return uri;
    const edge = lineMode === 'neon' ? NEON_EDGE : INK_EDGE;
    return lineArt[`${edge}|${uri}`] ?? uri;
  };
  const nativeOutline = Platform.OS !== 'web' && lineMode !== 'normal';

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
          {__DEV__ ? <Text style={styles.simulatorLabel}>Camera Feed (Simulator Mode)</Text> : null}
        </View>
      ) : isFocused ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={flashMode === 'torch'}
          flash={Platform.OS === 'web' ? (flashMode as 'off') : 'off'}
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
              {route.params.mode === 'single' && route.params.imageUri ? (
                nativeOutline ? (
                  <OutlinePhoto
                    uri={route.params.imageUri}
                    width={stencilWidth}
                    height={stencilHeight}
                    filterId="trace-gray-main"
                  />
                ) : (
                  <Image
                    source={{ uri: shownUri(route.params.imageUri) }}
                    style={{ width: stencilWidth, height: stencilHeight }}
                    resizeMode="contain"
                  />
                )
              ) : route.params.slots?.some(Boolean) || route.params.imageUri ? (
                <View style={{ width: stencilWidth, height: stencilHeight, flexDirection: 'row', flexWrap: 'wrap' }}>
                  {(route.params.slots?.length ? route.params.slots : [route.params.imageUri ?? null]).map(
                    (uri, index) => (
                      <View key={`${uri ?? 'empty'}-${index}`} style={{ width: '50%', height: '50%', padding: 6 }}>
                        {uri ? (
                          nativeOutline ? (
                            <OutlinePhoto
                              uri={uri}
                              width={stencilWidth / 2 - 12}
                              height={stencilHeight / 2 - 12}
                              filterId={`trace-gray-${index}`}
                            />
                          ) : (
                            <Image source={{ uri: shownUri(uri) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                          )
                        ) : null}
                      </View>
                    ),
                  )}
                </View>
              ) : (
                <SvgXml xml={svg} width={stencilWidth} height={stencilHeight} />
              )}
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
            onPress={confirmExit}
            style={[styles.circle, capturing && styles.disabled]}
          >
            <CloseIcon color={colors.white} />
          </Pressable>
          <View style={styles.topRight} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={flashMode === 'torch' ? 'Turn flashlight off' : 'Turn flashlight on'}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                setFlashMode((value) => (value === 'torch' ? 'off' : 'torch'));
              }}
              style={[styles.circle, flashMode === 'torch' && styles.circleOn]}
            >
              <Ionicons
                name={flashMode === 'torch' ? 'flashlight' : 'flashlight-outline'}
                size={22}
                color={flashMode === 'torch' ? colors.ink : colors.white}
              />
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
              <LockIcon color={isLocked ? colors.accent : colors.white} closed={isLocked} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.dock, { marginBottom: Math.max(insets.bottom, 16) }]}>
          {capturing ? <Text style={styles.hint}>Taking the photo…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.hint}>
            {isLocked
              ? 'Lines are locked. Draw on your paper.'
              : 'Pinch, turn, or drag the lines. Then lock them.'}
          </Text>
          <View style={styles.modes}>
            {TRACE_MODES.map((mode) => {
              const selected = lineMode === mode.id;
              return (
                <Pressable
                  key={mode.id}
                  accessibilityRole="button"
                  accessibilityLabel={mode.label}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => undefined);
                    setLineMode(mode.id);
                  }}
                  style={[styles.mode, selected && styles.modeOn]}
                >
                  <Text style={styles.modeText}>{mode.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Lines</Text>
            <Slider
              style={styles.slider}
              minimumValue={0.1}
              maximumValue={0.85}
              value={opacity}
              onValueChange={setOpacity}
              minimumTrackTintColor={colors.brand}
              maximumTrackTintColor={colors.stroke}
              thumbTintColor={colors.canvas}
              accessibilityLabel="Line opacity"
            />
            <Text style={styles.percent}>{Math.round(opacity * 100)}%</Text>
          </View>
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

      {exitAsk ? (
        <View style={styles.exitWrap}>
          <View style={styles.exitCard}>
            <Text style={styles.exitTitle}>Exit Drawing?</Text>
            <Text style={styles.exitBody}>Your current tracing progress will be closed.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keep Drawing"
              onPress={() => setExitAsk(false)}
              style={({ pressed }) => [styles.exitKeep, pressed && styles.pressed]}
            >
              <Text style={styles.exitKeepText}>Keep Drawing</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Exit"
              onPress={() => navigation.navigate('Studio')}
              style={({ pressed }) => [styles.exitLeave, pressed && styles.pressed]}
            >
              <Text style={styles.exitLeaveText}>Exit</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
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
    color: colors.white,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
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
    backgroundColor: colors.white,
  },
  circleLocked: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: '#FF3366',
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
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  error: {
    color: colors.accent,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  modes: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  mode: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F3F8',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FF2D55',
  },
  modeText: {
    color: '#111118',
    fontFamily: fonts.headingBold,
    fontSize: 13,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sliderLabel: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    width: 40,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  percent: {
    color: colors.white,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    width: 40,
    textAlign: 'right',
  },
  finish: {
    height: layout.pillHeight,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...buttonShadow,
  },
  finishText: {
    color: colors.white,
    fontFamily: fonts.headingBold,
    fontSize: 16,
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
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    padding: 20,
    ...shadow,
  },
  celebrateTitle: {
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  celebrateBody: {
    marginTop: 8,
    fontFamily: fonts.body,
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
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  permissionBody: {
    marginTop: 12,
    fontFamily: fonts.body,
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
    ...buttonShadow,
  },
  primaryText: {
    color: colors.white,
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  link: {
    marginTop: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: colors.brand,
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  exitWrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(17, 17, 24, 0.45)',
  },
  exitCard: {
    backgroundColor: '#18181B',
    borderRadius: 28,
    padding: 20,
  },
  exitTitle: {
    color: '#FFFFFF',
    fontFamily: fonts.heading,
    fontSize: 22,
    letterSpacing: -0.5,
  },
  exitBody: {
    marginTop: 8,
    color: '#8E8E93',
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  exitKeep: {
    marginTop: 16,
    height: 52,
    borderRadius: 24,
    backgroundColor: '#F2F3F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitKeepText: {
    color: '#111118',
    fontFamily: fonts.headingBold,
    fontSize: 17,
  },
  exitLeave: {
    marginTop: 10,
    height: 52,
    borderRadius: 24,
    backgroundColor: '#FF2D55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitLeaveText: {
    color: '#FFFFFF',
    fontFamily: fonts.headingBold,
    fontSize: 17,
  },
});
