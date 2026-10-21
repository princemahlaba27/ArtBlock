import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { usePostHog } from 'posthog-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import { isPreviewDevice } from '../runtime/previewDevice';
import { grantPremium, hasUsedFreeTrace, isPremium as readLocalPremium } from '../storage/preferences';
import { fonts } from '../theme/colors';

const paper = '#F8F9FD';
const hero = '#FF2D55';
const ink = '#111118';
const muted = '#8E8E93';
const card = '#FFFFFF';
const inactive = '#E5E5EA';
const secondary = '#F2F3F8';

const premiumShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.05,
  shadowRadius: 12,
  elevation: 3,
} as const;

const PROMPTS = [
  'Aesthetic anime eye sketch',
  'Y2K tattoo stencil',
  'Simple Marvel character drawing',
  'Minimalist butterfly line art',
  'Coquette bow doodle',
  'Dark grunge skull sketch',
];

type CameraPermissionApi = {
  getPermissionsAsync?: () => Promise<{ granted: boolean }>;
  getCameraPermissionsAsync?: () => Promise<{ granted: boolean }>;
  requestPermissionsAsync?: () => Promise<{ granted: boolean }>;
  requestCameraPermissionsAsync?: () => Promise<{ granted: boolean }>;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Studio'>;

async function loadCameraPermissions(): Promise<CameraPermissionApi> {
  const camera = await import('expo-camera');
  return camera.Camera as CameraPermissionApi;
}

function differentPrompt(current: number) {
  const next = Math.floor(Math.random() * (PROMPTS.length - 1));
  return next >= current ? next + 1 : next;
}

function alertNoImage() {
  try {
    Alert.alert("No image found. If you took a screenshot, tap 'Choose from Gallery'.");
  } catch {
    // Web builds where Alert is a no-op must not redbox.
  }
}

function alertInvalidLink() {
  try {
    Alert.alert('Invalid Image', 'You pasted a web link. Please copy the actual image and try again.');
  } catch {
    // Web builds where Alert is a no-op must not redbox.
  }
}

function imageDataUri(data: string): string {
  if (data.startsWith('data:image')) return data;
  return `data:image/jpeg;base64,${data}`;
}

function isDirectImageUrl(text: string): boolean {
  if (!text.toLowerCase().startsWith('http')) return false;
  const path = text.split('?')[0].split('#')[0].toLowerCase();
  return path.endsWith('.jpg') || path.endsWith('.png') || path.endsWith('.jpeg') || path.endsWith('.webp');
}

function pastedImageText(text: string): 'image' | 'link' | 'empty' {
  if (text.startsWith('data:image') || text.startsWith('file://') || isDirectImageUrl(text)) return 'image';
  const lower = text.toLowerCase();
  if (lower.startsWith('http') || lower.includes('pin.it') || lower.includes('pinterest.com')) return 'link';
  return 'empty';
}

export function InstantStudioScreen({ navigation }: Props) {
  const posthog = usePostHog();
  const insets = useSafeAreaInsets();
  const [promptIndex, setPromptIndex] = useState(() => Math.floor(Math.random() * PROMPTS.length));
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [cameraSlip, setCameraSlip] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [freeTraceUsed, setFreeTraceUsed] = useState(false);
  const imageUriRef = useRef<string | null>(null);
  const handlePasteRef = useRef<(quiet?: boolean) => Promise<void>>(async () => undefined);
  const prompt = PROMPTS[promptIndex] ?? PROMPTS[0];

  const reroll = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    setPromptIndex((current) => differentPrompt(current));
  };

  const searchPinterest = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const query = encodeURIComponent(prompt);
    const appUrl = 'pinterest://search/?q=' + query;
    const webUrl = 'https://www.pinterest.com/search/pins/?q=' + query;
    const openWeb = () => Linking.openURL(webUrl).catch(() => undefined);

    if (Platform.OS === 'web') {
      void openWeb();
      return;
    }

    void (async () => {
      try {
        const canOpen = await Linking.canOpenURL(appUrl);
        if (!canOpen) {
          await openWeb();
          return;
        }
        await Linking.openURL(appUrl);
      } catch {
        await openWeb();
      }
    })();
  };

  const handlePaste = async (quiet = false) => {
    if (pasting) return;
    setPasting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      let uri: string | null = null;
      if (typeof Clipboard.getImageAsync === 'function') {
        try {
          const image = await Clipboard.getImageAsync({ format: 'jpeg' });
          if (image?.data) uri = imageDataUri(image.data);
        } catch {
          uri = null;
        }
      }
      if (!uri && typeof Clipboard.getStringAsync === 'function') {
        try {
          const text = (await Clipboard.getStringAsync()).trim();
          const kind = pastedImageText(text);
          if (kind === 'image') {
            uri = text;
          } else if (kind === 'link') {
            imageUriRef.current = null;
            setImageUri(null);
            if (!quiet) alertInvalidLink();
            return;
          }
        } catch {
          uri = null;
        }
      }
      if (!uri) {
        if (!quiet) alertNoImage();
        return;
      }
      imageUriRef.current = uri;
      setImageUri(uri);
    } catch {
      if (!quiet) alertNoImage();
    } finally {
      setPasting(false);
    }
  };
  handlePasteRef.current = handlePaste;

  const chooseFromGallery = async () => {
    try {
      if (Platform.OS !== 'web') {
        const current = await ImagePicker.getMediaLibraryPermissionsAsync();
        const next = current.granted ? current : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!next.granted) return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;
      imageUriRef.current = uri;
      setImageUri(uri);
    } catch {
      // A closed picker or a missing native module leaves the frame as it is.
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let premium = false;
      try {
        const [stored, used] = await Promise.all([readLocalPremium(), hasUsedFreeTrace()]);
        premium = stored;
        if (!cancelled) {
          setIsPremium(stored);
          setFreeTraceUsed(used);
        }
      } catch {
        // The button stays on the in-memory defaults if storage cannot be read.
      }
      if (premium || Platform.OS === 'web' || cancelled) return;
      try {
        const purchases = await import('react-native-purchases');
        const configured = await purchases.default.isConfigured();
        if (!configured || cancelled) return;
        const info = await purchases.default.getCustomerInfo();
        if (cancelled || !info.entitlements.active.pro) return;
        await grantPremium();
        if (!cancelled) setIsPremium(true);
      } catch {
        // A failed customer check keeps the local flag.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || imageUriRef.current) return;
      void (async () => {
        try {
          if (typeof Clipboard.hasImageAsync !== 'function' || typeof Clipboard.getImageAsync !== 'function') return;
          const hasImage = await Clipboard.hasImageAsync();
          if (!hasImage || imageUriRef.current) return;
          await handlePasteRef.current(true);
        } catch {
          // Web builds without clipboard image APIs stay on the manual Paste button.
        }
      })();
    });
    return () => subscription.remove();
  }, []);

  const traceParams = () => ({
    title: prompt,
    prompts: [prompt],
    mode: 'single' as const,
    imageUri: imageUri ?? '',
  });

  const openPaywall = () => {
    if (!imageUri) return;
    navigation.navigate('Paywall', { ...traceParams(), intent: 'trace' });
  };

  const continueToTrace = () => {
    if (!imageUri) return;
    navigation.navigate('Trace', traceParams());
    try {
      posthog.capture('trace_started', { prompt_text: prompt });
    } catch {
      // A placeholder key must not take the screen down.
    }
  };

  const openCameraGate = () => {
    if (Platform.OS === 'web' || isPreviewDevice()) {
      setCameraSlip(true);
      return;
    }
    void (async () => {
      try {
        const cameraApi = await loadCameraPermissions();
        const readPermission = cameraApi.getPermissionsAsync ?? cameraApi.getCameraPermissionsAsync;
        const status = readPermission ? await readPermission() : { granted: false };
        if (status.granted) {
          continueToTrace();
          return;
        }
      } catch {
        // Show the slip when the permission read cannot run.
      }
      setCameraSlip(true);
    })();
  };

  const openTrace = () => {
    if (!imageUri) return;
    try {
      posthog.capture('trace_attempted', { is_premium: isPremium });
    } catch {
      // A placeholder key must not take the screen down.
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    if (isPremium) {
      openCameraGate();
      return;
    }
    if (Platform.OS === 'web') {
      if (freeTraceUsed) openPaywall();
      else openCameraGate();
      return;
    }
    void (async () => {
      let premium = false;
      try {
        const purchases = await import('react-native-purchases');
        const configured = await purchases.default.isConfigured();
        if (!configured) throw new Error('Purchases is not configured');
        const info = await purchases.default.getCustomerInfo();
        if (info.entitlements.active.pro) {
          await grantPremium();
          setIsPremium(true);
          premium = true;
        }
      } catch {
        premium = isPremium;
      }
      if (premium) {
        openCameraGate();
        return;
      }
      if (freeTraceUsed) {
        openPaywall();
        return;
      }
      openCameraGate();
    })();
  };

  const acceptCamera = async () => {
    if (Platform.OS === 'web' || isPreviewDevice()) {
      setCameraSlip(false);
      continueToTrace();
      return;
    }
    try {
      const cameraApi = await loadCameraPermissions();
      const requestPermission = cameraApi.requestPermissionsAsync ?? cameraApi.requestCameraPermissionsAsync;
      const status = requestPermission ? await requestPermission() : { granted: false };
      if (!status.granted) {
        setCameraSlip(false);
        return;
      }
    } catch {
      setCameraSlip(false);
      return;
    }
    setCameraSlip(false);
    continueToTrace();
  };

  const clearImage = () => {
    imageUriRef.current = null;
    setImageUri(null);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {cameraSlip ? (
        <TouchableOpacity
          accessibilityLabel="Close camera prompt"
          activeOpacity={1}
          onPress={() => setCameraSlip(false)}
          style={styles.slipLayer}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => undefined} style={styles.slipCard}>
            <Text style={styles.slipText}>
              We need your camera to project lines onto your paper. We never record you.
            </Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Accept" onPress={() => void acceptCamera()} style={styles.primary}>
              <Text style={styles.primaryText}>Accept</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.brand}>ArtBlock</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Settings" onPress={() => navigation.navigate('Settings')}>
              <Ionicons name="settings-outline" size={28} color={ink} />
            </TouchableOpacity>
          </View>

          <View style={styles.ribbon}>
            <View style={styles.ribbonCopy}>
              <Text style={styles.ideaLabel}>IDEA</Text>
              <Text style={styles.ideaText} numberOfLines={1} ellipsizeMode="tail">
                {prompt}
              </Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Roll" onPress={reroll} style={styles.roll}>
              <Text style={styles.rollDice}>🎲</Text>
              <Text style={styles.rollText}>Roll</Text>
            </TouchableOpacity>
          </View>

          <View accessibilityLabel={imageUri ? prompt : 'Waiting for reference art...'} style={styles.canvas}>
            {imageUri ? (
              <Image accessibilityIgnoresInvertColors source={{ uri: imageUri }} style={styles.art} resizeMode="contain" />
            ) : (
              <View style={styles.empty}>
                <Ionicons name="image-outline" size={44} color={muted} />
                <Text style={styles.emptyText}>Waiting for reference art...</Text>
              </View>
            )}
            {imageUri ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove image" onPress={clearImage} style={styles.clear}>
                <Ionicons name="close" size={20} color={card} />
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.hint}>Copy an image from anywhere, then return here to paste.</Text>
          <View style={styles.pair}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Pinterest" onPress={searchPinterest} style={styles.side}>
              <Ionicons name="search-outline" size={18} color={ink} />
              <Text style={styles.sideText}>Pinterest</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Photos" onPress={() => void chooseFromGallery()} style={styles.side}>
              <Ionicons name="image-outline" size={18} color={ink} />
              <Text style={styles.sideText}>Photos</Text>
            </TouchableOpacity>
          </View>
          {imageUri ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Start Camera Trace" onPress={() => void openTrace()} style={styles.primary}>
              <Text style={styles.primaryText}>Start Camera Trace</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Paste Image"
              accessibilityState={{ disabled: pasting }}
              disabled={pasting}
              onPress={() => void handlePaste()}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Paste Image</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: paper,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brand: {
    fontFamily: fonts.headingBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: ink,
  },
  ribbon: {
    height: 64,
    backgroundColor: card,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    ...premiumShadow,
  },
  ribbonCopy: {
    flex: 1,
    marginRight: 10,
  },
  ideaLabel: {
    fontFamily: fonts.headingBold,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: muted,
    letterSpacing: 1,
  },
  ideaText: {
    fontFamily: fonts.headingBold,
    fontSize: 15,
    fontWeight: '700',
    color: ink,
  },
  roll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: secondary,
    borderRadius: 16,
    gap: 4,
  },
  rollDice: {
    fontSize: 13,
  },
  rollText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '600',
    color: ink,
  },
  canvas: {
    flex: 1,
    maxHeight: 340,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    ...premiumShadow,
  },
  empty: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: inactive,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 14,
    color: muted,
  },
  art: {
    width: '100%',
    height: '100%',
  },
  clear: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderRadius: 14,
    padding: 4,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: muted,
    textAlign: 'center',
    marginBottom: 10,
  },
  pair: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  side: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: inactive,
    backgroundColor: card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sideText: {
    fontFamily: fonts.headingBold,
    fontSize: 15,
    color: ink,
  },
  primary: {
    height: 56,
    borderRadius: 28,
    backgroundColor: hero,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryText: {
    fontFamily: fonts.headingBold,
    fontSize: 17,
    fontWeight: '700',
    color: card,
  },
  slipLayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slipCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: card,
    borderRadius: 24,
    padding: 24,
    gap: 20,
    ...premiumShadow,
  },
  slipText: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: ink,
  },
});
