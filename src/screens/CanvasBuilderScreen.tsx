import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  PanGestureHandler,
  PinchGestureHandler,
  RotationGestureHandler,
  State,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import type { RootStackParamList } from '../navigation/types';
import { toLineArt } from '../runtime/lineArt';
import { fonts } from '../theme/colors';

const hero = '#FF2D55';
const paper = '#F8F9FD';
const ink = '#111118';
const muted = '#8E8E93';
const card = '#FFFFFF';
const inactive = '#E5E5EA';

const premiumShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.05,
  shadowRadius: 12,
  elevation: 3,
} as const;

const ROLL_MESSAGE =
  'The camera roll is not available in this browser. You can still start the camera trace.';

type Props = NativeStackScreenProps<RootStackParamList, 'Canvas'>;

function ended(state: number) {
  return state === State.END || state === State.CANCELLED || state === State.FAILED;
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} style={styles.back}>
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path d="M15 5 L8 12 L15 19" stroke={ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </Pressable>
  );
}

function FilledPhoto({ uri }: { uri: string }) {
  const panRef = useRef(null);
  const pinchRef = useRef(null);
  const rotationRef = useRef(null);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const savedRotation = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const onPan = (event: { nativeEvent: { translationX: number; translationY: number } }) => {
    translateX.value = savedX.value + event.nativeEvent.translationX;
    translateY.value = savedY.value + event.nativeEvent.translationY;
  };
  const onPanState = (event: { nativeEvent: { state: number } }) => {
    if (!ended(event.nativeEvent.state)) return;
    savedX.value = translateX.value;
    savedY.value = translateY.value;
  };
  const onPinch = (event: { nativeEvent: { scale: number } }) => {
    const next = savedScale.value * (event.nativeEvent.scale || 1);
    scale.value = Math.min(4, Math.max(0.4, next));
  };
  const onPinchState = (event: { nativeEvent: { state: number } }) => {
    if (!ended(event.nativeEvent.state)) return;
    savedScale.value = scale.value;
  };
  const onRotate = (event: { nativeEvent: { rotation: number } }) => {
    rotation.value = savedRotation.value + (event.nativeEvent.rotation || 0);
  };
  const onRotateState = (event: { nativeEvent: { state: number } }) => {
    if (!ended(event.nativeEvent.state)) return;
    savedRotation.value = rotation.value;
  };
  const pose = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}rad` },
      { scale: scale.value },
    ],
  }));

  const filtered = Platform.OS === 'web' && !uri.startsWith('data:');

  return (
    <PanGestureHandler
      ref={panRef}
      simultaneousHandlers={[pinchRef, rotationRef]}
      onGestureEvent={onPan}
      onHandlerStateChange={onPanState}
    >
      <Animated.View style={styles.gestureFill} collapsable={false}>
        <PinchGestureHandler
          ref={pinchRef}
          simultaneousHandlers={[panRef, rotationRef]}
          onGestureEvent={onPinch}
          onHandlerStateChange={onPinchState}
        >
          <Animated.View style={styles.gestureFill} collapsable={false}>
            <RotationGestureHandler
              ref={rotationRef}
              simultaneousHandlers={[panRef, pinchRef]}
              onGestureEvent={onRotate}
              onHandlerStateChange={onRotateState}
            >
              <Animated.View style={[styles.photoPose, pose]} collapsable={false}>
                <Animated.Image
                  source={{ uri }}
                  style={[styles.photo, filtered ? styles.photoFilter : null]}
                  resizeMode="cover"
                />
              </Animated.View>
            </RotationGestureHandler>
          </Animated.View>
        </PinchGestureHandler>
      </Animated.View>
    </PanGestureHandler>
  );
}

type SlotKind = 'character' | 'botanical' | 'quote' | 'doodle';

function slotKind(prompt: string): SlotKind {
  const text = prompt.toLowerCase();
  if (text.includes('character') || text.includes('animal')) return 'character';
  if (text.includes('flower') || text.includes('botanical')) return 'botanical';
  if (text.includes('quote')) return 'quote';
  return 'doodle';
}

function CategoryMark({ kind }: { kind: SlotKind }) {
  const color = '#C7C7CC';
  if (kind === 'character') {
    return (
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Path d="M32 10 a10 10 0 1 1 0 20 a10 10 0 1 1 0-20" stroke={color} strokeWidth={2.2} fill="none" />
        <Path d="M14 54 c2-12 10-18 18-18 s16 6 18 18" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      </Svg>
    );
  }
  if (kind === 'botanical') {
    return (
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Path d="M32 54 V28" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Path d="M32 34 C20 32 16 20 22 14 C28 22 32 28 32 34" stroke={color} strokeWidth={2.2} fill="none" />
        <Path d="M32 40 C44 36 50 24 44 16 C38 24 34 32 32 40" stroke={color} strokeWidth={2.2} fill="none" />
      </Svg>
    );
  }
  if (kind === 'quote') {
    return (
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Path d="M16 28 h10 v8 c0 6-4 10-10 10" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <Path d="M36 28 h10 v8 c0 6-4 10-10 10" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64">
      <Path d="M16 42 C22 28 28 36 34 24 C40 34 46 22 50 30" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Path d="M18 48 h28" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function Polaroid({
  prompt,
  uri,
  onPress,
}: {
  prompt: string;
  uri: string | null;
  onPress: () => void;
}) {
  return (
    <View style={styles.polaroid}>
      {uri ? (
        <View style={styles.well}>
          <FilledPhoto uri={uri} />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Copy ${prompt}`}
          onPress={onPress}
          style={styles.wellEmpty}
        >
          <CategoryMark kind={slotKind(prompt)} />
        </Pressable>
      )}
      <Text style={styles.caption} numberOfLines={2}>
        {prompt}
      </Text>
    </View>
  );
}

export function CanvasBuilderScreen({ navigation, route }: Props) {
  const prompts = route.params.prompts;
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    prompts.map((_, index) => route.params.slots?.[index] ?? null),
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const openSlot = async (index: number) => {
    const prompt = prompts[index];
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(prompt);
    } catch {
      // The modal still tells them the prompt was copied.
    }
    setNotice(null);
    setCopiedPrompt(prompt);
    setActiveIndex(index);
  };

  const closeModal = () => {
    setActiveIndex(null);
  };

  const importSlot = async () => {
    if (activeIndex == null || importing) return;
    const index = activeIndex;
    setImporting(true);
    setNotice(null);
    try {
      const ImagePicker = await import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]?.uri) {
        if (Platform.OS === 'web') setNotice(ROLL_MESSAGE);
        return;
      }
      const art = await toLineArt(result.assets[0].uri);
      setSlots((current) => {
        const next = [...current];
        next[index] = art;
        return next;
      });
      closeModal();
    } catch {
      setNotice(ROLL_MESSAGE);
      closeModal();
    } finally {
      setImporting(false);
    }
  };

  const startTrace = () => {
    const imageUri = slots.find((uri): uri is string => Boolean(uri));
    navigation.navigate('Trace', {
      title: route.params.title,
      prompts,
      slots,
      imageUri,
      mode: 'spread',
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.title} numberOfLines={1}>
          {route.params.title}
        </Text>
      </View>

      <View style={styles.canvas}>
        {[0, 1].map((row) => (
          <View key={row} style={styles.row}>
            {prompts.slice(row * 2, row * 2 + 2).map((prompt, column) => {
              const index = row * 2 + column;
              return (
                <Polaroid
                  key={prompt}
                  prompt={prompt}
                  uri={slots[index] ?? null}
                  onPress={() => void openSlot(index)}
                />
              );
            })}
          </View>
        ))}
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Pressable accessibilityRole="button" accessibilityLabel="Start Camera Trace" onPress={startTrace} style={styles.pill}>
        <Text style={styles.pillText}>Start Camera Trace</Text>
      </Pressable>

      <Modal visible={activeIndex != null} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalText}>
              {`Copied '${copiedPrompt ?? ''}'! Open Pinterest, screenshot an aesthetic image, and return here to import it.`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Import image"
              disabled={importing}
              onPress={() => void importSlot()}
              style={[styles.pill, importing && styles.pillBusy]}
            >
              <Text style={styles.pillText}>{importing ? 'Opening…' : 'Import image'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={closeModal} style={styles.dismiss}>
              <Text style={styles.dismissText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: paper,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: card,
    alignItems: 'center',
    justifyContent: 'center',
    ...premiumShadow,
  },
  title: {
    flex: 1,
    fontFamily: fonts.headingBold,
    fontSize: 22,
    color: ink,
    letterSpacing: -0.5,
  },
  canvas: {
    flex: 1,
    gap: 12,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  polaroid: {
    flex: 1,
    backgroundColor: card,
    borderRadius: 16,
    padding: 12,
    ...premiumShadow,
  },
  well: {
    flex: 1,
    minHeight: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: paper,
  },
  wellEmpty: {
    flex: 1,
    minHeight: 120,
    borderRadius: 12,
    backgroundColor: paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gestureFill: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPose: {
    width: '100%',
    height: '100%',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoFilter: {
    filter: 'grayscale(1) contrast(2.8) brightness(1.15)',
  } as object,
  caption: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 17,
    color: ink,
  },
  notice: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: muted,
  },
  pill: {
    height: 56,
    borderRadius: 28,
    backgroundColor: hero,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  pillBusy: {
    opacity: 0.7,
  },
  pillText: {
    fontFamily: fonts.headingBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 17, 24, 0.46)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: card,
    borderRadius: 16,
    padding: 20,
    ...premiumShadow,
  },
  modalText: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 23,
    color: ink,
    marginBottom: 16,
  },
  dismiss: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dismissText: {
    fontFamily: fonts.headingBold,
    fontSize: 16,
    color: ink,
  },
});
