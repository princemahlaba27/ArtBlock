import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { usePostHog } from 'posthog-react-native';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { View as ViewType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { PermissionPrimer } from '../components/PermissionPrimer';
import type { RootStackParamList } from '../navigation/types';
import { isPremium, requestReviewAfterFirstTrace, saveFeedback } from '../storage/preferences';
import { deleteSketch, formatDuration, saveSketch } from '../storage/sketchbook';
import { buttonShadow, colors, fonts, layout, shadow } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Reveal'>;
type PreviewMode = 'reference' | 'photo';

const PRIMARY = '#FF2D55';
const EXPORT_BG = '#0F0F12';
const SHEET_WIDTH = 1080;
const SHEET_HEIGHT = 1920;
const WATERMARK = '✏️ Traced with ArtBlock';

function ReferenceArt({
  svg,
  imageUri,
  width,
  height,
}: {
  svg: string;
  imageUri?: string;
  width: number;
  height: number;
}) {
  if (imageUri) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: imageUri }}
        style={{ width, height }}
        resizeMode="contain"
      />
    );
  }
  if (width > 0 && height > 0 && svg) {
    return <SvgXml xml={svg} width={width} height={height} />;
  }
  if (!svg) return <Text style={styles.missing}>Reference unavailable</Text>;
  return null;
}

export function SketchRevealScreen({ navigation, route }: Props) {
  const posthog = usePostHog();
  const insets = useSafeAreaInsets();
  const { title, photoUri } = route.params;
  const [sketchId, setSketchId] = useState(route.params.id?.trim() || undefined);
  const seconds = route.params.duration ?? route.params.seconds ?? 0;
  const svg = route.params.svg ?? '';
  const referenceUri = route.params.referenceUri?.trim() || route.params.imageUri?.trim() || undefined;
  const slide1Ref = useRef<ViewType>(null);
  const slide2Ref = useRef<ViewType>(null);
  const [preview, setPreview] = useState<PreviewMode>('reference');
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [savedUri, setSavedUri] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askReview, setAskReview] = useState(false);
  const [stars, setStars] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [photoPrimer, setPhotoPrimer] = useState(false);
  const [rollSaved, setRollSaved] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [proReady, setProReady] = useState(false);
  const [includeBadge, setIncludeBadge] = useState(true);
  const [deleteAsk, setDeleteAsk] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const drawingDurationText = formatDuration(seconds);
  const timeLine =
    seconds <= 0 ? 'You drew for less than a second.' : `You drew for ${drawingDurationText}.`;
  const showWatermark = isPro ? includeBadge : true;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void isPremium()
        .then((value) => {
          if (active) setIsPro(value);
        })
        .catch(() => {
          if (active) setIsPro(false);
        })
        .finally(() => {
          if (active) setProReady(true);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const leaveToStudio = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Studio' }] });
  };

  const removeSavedSketch = async () => {
    if (!sketchId || deleting) return;
    setDeleteAsk(false);
    setDeleting(true);
    setError(null);
    try {
      await deleteSketch(sketchId);
      navigation.goBack();
    } catch {
      setError('Could not delete this sketch.');
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    if (!sketchId) return;
    void Haptics.selectionAsync().catch(() => undefined);
    if (Platform.OS === 'web') {
      setDeleteAsk(true);
      return;
    }
    Alert.alert('Delete Sketch', 'Are you sure you want to permanently delete this sketch?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeSavedSketch() },
    ]);
  };

  const markTraceShared = () => {
    void requestReviewAfterFirstTrace();
    try {
      posthog.capture('trace_completed');
    } catch {
      // A placeholder key must not take the screen down.
    }
  };

  const save = async () => {
    if (saving || savedUri) return;
    setSaving(true);
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    try {
      const { record, total, photoUri: storedUri } = await saveSketch({
        title,
        duration: seconds,
        photoUri,
        referenceUri,
      });
      setSketchId((current) => current ?? record.id);
      setSavedUri(storedUri);
      setBanner(total === 1 ? 'Saved to My Sketchbook' : `${total} drawings saved`);
      if (total === 1) setAskReview(true);
      void requestReviewAfterFirstTrace();
      try {
        posthog.capture('trace_completed');
      } catch {
        // A placeholder key must not take the screen down.
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      setError('Could not save this drawing. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const rate = (value: number) => {
    setStars(value);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (value >= 5) setAskReview(false);
  };

  const sendFeedback = async () => {
    const note = feedback.trim();
    if (!note) return;
    await saveFeedback(note, stars);
    setFeedbackSent(true);
    setAskReview(false);
  };

  const saveToRoll = async () => {
    setPhotoPrimer(false);
    if (Platform.OS === 'web') {
      setError('Saving to the camera roll works on your phone, not in the browser.');
      return;
    }
    try {
      const MediaLibrary = await import('expo-media-library/legacy');
      const current = await MediaLibrary.getPermissionsAsync(true);
      const next = current.granted ? current : await MediaLibrary.requestPermissionsAsync(true);
      if (!next.granted) {
        setError('The photo library stays closed until you allow it.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(savedUri ?? photoUri);
      setRollSaved(true);
    } catch {
      setError('Could not save this photo to your camera roll.');
    }
  };

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      if (Platform.OS === 'web') {
        try {
          Alert.alert('Share to TikTok', 'The TikTok carousel export runs on the phone.');
        } catch {
          // Web builds where Alert is a no-op must not redbox.
        }
        return;
      }
      const { captureRef } = await import('react-native-view-shot');
      const slide1 = await captureRef(slide1Ref, { format: 'png', quality: 1.0 });
      const slide2 = await captureRef(slide2Ref, { format: 'png', quality: 1.0 });
      const MediaLibrary = await import('expo-media-library/legacy');
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Photo library access was denied, so the carousel was not saved.');
        Alert.alert(
          'Photos access needed',
          'Photo library access was denied, so the carousel was not saved.',
        );
        return;
      }
      await MediaLibrary.createAssetAsync(slide1);
      await MediaLibrary.createAssetAsync(slide2);
      setBanner('2 carousel slides saved to Photos.');
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setError('Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(slide2, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: 'Share to TikTok',
      });
      markTraceShared();
    } catch {
      setError('The share sheet did not open. Try again.');
    } finally {
      setSharing(false);
    }
  };

  const openUpgrade = () => {
    navigation.navigate('Paywall', {
      title: 'ArtBlock Pro',
      prompts: [],
      mode: 'single',
    });
  };

  const choosePreview = (mode: PreviewMode) => {
    setPreview(mode);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={leaveToStudio} style={styles.back}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          {sketchId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete sketch"
              disabled={deleting}
              onPress={confirmDelete}
              style={styles.trash}
            >
              <Ionicons name="trash-outline" size={22} color={PRIMARY} />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.time}>{timeLine}</Text>

        <View style={styles.segment}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: preview === 'reference' }}
            onPress={() => choosePreview('reference')}
            style={[styles.segmentItem, preview === 'reference' && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, preview === 'reference' && styles.segmentTextOn]}>Reference</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: preview === 'photo' }}
            onPress={() => choosePreview('photo')}
            style={[styles.segmentItem, preview === 'photo' && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, preview === 'photo' && styles.segmentTextOn]}>Your photo</Text>
          </Pressable>
        </View>

        <View
          style={styles.preview}
          onLayout={(event) => {
            const nextWidth = event.nativeEvent.layout.width;
            const nextHeight = event.nativeEvent.layout.height;
            setFrame((current) =>
              current.width === nextWidth && current.height === nextHeight
                ? current
                : { width: nextWidth, height: nextHeight },
            );
          }}
        >
          {preview === 'reference' ? (
            <ReferenceArt svg={svg} imageUri={referenceUri} width={frame.width} height={frame.height} />
          ) : (
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: photoUri }}
              style={{ width: frame.width, height: frame.height }}
              resizeMode="contain"
            />
          )}
        </View>

        {banner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={saving || Boolean(savedUri)}
          onPress={() => void save()}
          style={({ pressed }) => [
            styles.primary,
            (saving || savedUri) && styles.disabled,
            pressed && !saving && !savedUri && styles.pressed,
          ]}
        >
          <Text style={styles.primaryText}>
            {savedUri ? 'Saved' : saving ? 'Saving…' : 'Save to My Sketchbook'}
          </Text>
        </Pressable>

        {isPro ? (
          <View style={styles.badgeRow}>
            <Text style={styles.badgeLabel}>Include ArtBlock badge</Text>
            <Switch
              value={includeBadge}
              onValueChange={(next) => {
                setIncludeBadge(next);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              }}
              trackColor={{ false: '#D1D1D6', true: PRIMARY }}
              thumbColor={colors.white}
              accessibilityLabel="Include ArtBlock badge"
            />
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={sharing}
          onPress={() => void share()}
          style={({ pressed }) => [styles.secondary, sharing && styles.disabled, pressed && !sharing && styles.pressed]}
        >
          <Text style={styles.secondaryText}>{sharing ? 'Opening…' : 'Share to TikTok'}</Text>
        </Pressable>
        {proReady && !isPro ? (
          <Pressable accessibilityRole="button" onPress={openUpgrade} style={styles.watermarkNote}>
            <Text style={styles.watermarkNoteText}>Watermark included • Tap to remove with Pro</Text>
          </Pressable>
        ) : null}

        {savedUri ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setPhotoPrimer(true)}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>{rollSaved ? 'Saved to camera roll' : 'Save to Camera Roll'}</Text>
          </Pressable>
        ) : null}
        {savedUri ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.reset({
                index: 1,
                routes: [{ name: 'Studio' }, { name: 'Sketchbook' }],
              })
            }
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Text style={styles.linkText}>See My Sketchbook</Text>
          </Pressable>
        ) : null}

        {askReview ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>How did your first physical trace turn out?</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable key={value} accessibilityRole="button" onPress={() => void rate(value)}>
                  <Text style={[styles.star, value <= stars && styles.starOn]}>{value <= stars ? '★' : '☆'}</Text>
                </Pressable>
              ))}
            </View>
            {stars > 0 && stars < 5 ? (
              <>
                <Text style={styles.help}>What can we make easier?</Text>
                <TextInput
                  value={feedback}
                  onChangeText={setFeedback}
                  placeholder="Tell us in a sentence"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  multiline
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void sendFeedback()}
                  style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryText}>Send</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}
        {feedbackSent ? <Text style={styles.help}>Thanks. We’ll use that.</Text> : null}
        <PermissionPrimer
          visible={photoPrimer}
          title="Save to your camera roll"
          body="ArtBlock puts this photo in your camera roll only when you ask."
          confirmLabel="Continue"
          onConfirm={() => void saveToRoll()}
          onDismiss={() => setPhotoPrimer(false)}
        />
      </ScrollView>
      {deleteAsk ? (
        <View style={styles.confirmLayer}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete Sketch</Text>
            <Text style={styles.confirmBody}>Are you sure you want to permanently delete this sketch?</Text>
            <Pressable accessibilityRole="button" onPress={() => setDeleteAsk(false)} style={styles.confirmCancel}>
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void removeSavedSketch()} style={styles.confirmDelete}>
              <Text style={styles.confirmDeleteText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View
        ref={slide1Ref}
        collapsable={false}
        pointerEvents="none"
        style={styles.sheet}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.capsule}>
          <Text style={styles.capsuleText} numberOfLines={1} adjustsFontSizeToFit>
            THE REFERENCE
          </Text>
        </View>
        <View style={styles.exportCard}>
          <ReferenceArt svg={svg} imageUri={referenceUri} width={880} height={1180} />
        </View>
        {showWatermark ? (
          <View style={styles.frost}>
            <Text style={styles.frostText}>{WATERMARK}</Text>
          </View>
        ) : null}
      </View>

      <View
        ref={slide2Ref}
        collapsable={false}
        pointerEvents="none"
        style={[styles.sheet, styles.sheetSecond]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.capsule}>
          <Text style={styles.capsuleText} numberOfLines={1} adjustsFontSizeToFit>
            {`TRACED WITH AR • ${drawingDurationText}`}
          </Text>
        </View>
        <View style={styles.exportCard}>
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: photoUri }}
            style={styles.exportArt}
            resizeMode="contain"
          />
        </View>
        {showWatermark ? (
          <View style={styles.frost}>
            <Text style={styles.frostText}>{WATERMARK}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
    overflow: 'visible',
  },
  content: {
    paddingHorizontal: 16,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  trash: {
    width: 40,
    height: 40,
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
    backgroundColor: PRIMARY,
  },
  confirmDeleteText: {
    color: colors.white,
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  backText: {
    color: PRIMARY,
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  title: {
    marginTop: 8,
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  time: {
    marginTop: 6,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  segment: {
    marginTop: 16,
    flexDirection: 'row',
    padding: 4,
    borderRadius: 28,
    backgroundColor: colors.card,
    ...shadow,
  },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentOn: {
    backgroundColor: PRIMARY,
  },
  segmentText: {
    color: colors.ink,
    fontFamily: fonts.headingBold,
    fontSize: 14,
  },
  segmentTextOn: {
    color: colors.white,
  },
  preview: {
    marginTop: 12,
    height: 440,
    borderRadius: layout.cardRadius,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    ...shadow,
  },
  missing: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  help: {
    marginTop: 14,
    marginBottom: 8,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
  },
  banner: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    padding: 14,
    ...shadow,
  },
  bannerText: {
    color: colors.ink,
    fontFamily: fonts.headingBold,
    fontSize: 16,
    lineHeight: 22,
  },
  stars: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  star: {
    fontSize: 28,
    color: colors.muted,
  },
  starOn: {
    color: PRIMARY,
  },
  input: {
    marginTop: 8,
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: colors.canvas,
    padding: 12,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  error: {
    marginTop: 12,
    color: colors.accent,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  primary: {
    marginTop: 16,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    ...buttonShadow,
    shadowColor: PRIMARY,
  },
  primaryText: {
    color: colors.white,
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  badgeRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadow,
  },
  badgeLabel: {
    flex: 1,
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  secondary: {
    marginTop: 12,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    ...shadow,
  },
  secondaryText: {
    color: colors.ink,
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  watermarkNote: {
    marginTop: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  watermarkNoteText: {
    color: PRIMARY,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  link: {
    marginTop: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: PRIMARY,
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  sheet: {
    position: 'absolute',
    left: -4000,
    top: 0,
    width: SHEET_WIDTH,
    height: SHEET_HEIGHT,
    backgroundColor: EXPORT_BG,
  },
  sheetSecond: {
    left: -5200,
  },
  capsule: {
    alignSelf: 'center',
    marginTop: 72,
    maxWidth: 960,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  capsuleText: {
    color: colors.white,
    fontFamily: fonts.headingBold,
    fontSize: 28,
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  exportCard: {
    alignSelf: 'center',
    marginTop: 36,
    width: 952,
    height: 1360,
    borderRadius: 40,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.4,
    shadowRadius: 28,
    elevation: 16,
    overflow: 'hidden',
  },
  exportArt: {
    width: 880,
    height: 1180,
  },
  frost: {
    position: 'absolute',
    left: 56,
    bottom: 64,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  frostText: {
    color: colors.white,
    fontFamily: fonts.headingBold,
    fontSize: 26,
  },
});
