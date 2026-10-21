import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { usePostHog } from 'posthog-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { PermissionPrimer } from '../components/PermissionPrimer';
import type { RootStackParamList } from '../navigation/types';
import { requestReviewAfterFirstTrace, saveFeedback } from '../storage/preferences';
import { formatDuration, saveSketch } from '../storage/sketchbook';
import { buttonShadow, colors, fonts, layout, shadow } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Reveal'>;

export function SketchRevealScreen({ navigation, route }: Props) {
  const posthog = usePostHog();
  const insets = useSafeAreaInsets();
  const { title, svg, photoUri, seconds } = route.params;
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

  const timeLine =
    seconds <= 0 ? 'You drew for less than a second.' : `You drew for ${formatDuration(seconds)}.`;

  const save = async () => {
    if (saving || savedUri) return;
    setSaving(true);
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    try {
      const { total, photoUri: storedUri } = await saveSketch({ title, seconds, photoUri });
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
    const MediaLibrary = require('expo-media-library');
    const current = await MediaLibrary.getPermissionsAsync(true);
    const next = current.granted ? current : await MediaLibrary.requestPermissionsAsync(true);
    if (!next.granted) {
      setError('The photo library stays closed until you allow it.');
      return;
    }
    await MediaLibrary.saveToLibraryAsync(savedUri ?? photoUri);
    setRollSaved(true);
  };

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setError('Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(savedUri ?? photoUri, {
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
        dialogTitle: 'Share to TikTok',
      });
      void requestReviewAfterFirstTrace();
      try {
        posthog.capture('trace_completed');
      } catch {
        // A placeholder key must not take the screen down.
      }
    } catch {
      setError('The share sheet did not open. Try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 12 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.time}>{timeLine}</Text>
      <Text style={styles.help}>Drag the line to compare.</Text>
      <BeforeAfterSlider svg={svg} photoUri={photoUri} />

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
      <Pressable
        accessibilityRole="button"
        disabled={sharing}
        onPress={() => void share()}
        style={({ pressed }) => [styles.secondary, sharing && styles.disabled, pressed && !sharing && styles.pressed]}
      >
        <Text style={styles.secondaryText}>{sharing ? 'Opening…' : 'Share to TikTok'}</Text>
      </Pressable>
      {savedUri ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setPhotoPrimer(true)}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>
            {rollSaved ? 'Saved to camera roll' : 'Save to Camera Roll'}
          </Text>
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
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    backgroundColor: colors.canvas,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backText: {
    color: colors.brand,
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
    color: colors.brand,
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
  secondary: {
    marginTop: 12,
    height: layout.pillHeight,
    borderRadius: layout.pillRadius,
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
  link: {
    marginTop: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: colors.brand,
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
});
