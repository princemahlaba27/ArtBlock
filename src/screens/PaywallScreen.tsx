import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { usePostHog } from 'posthog-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PROD_ID_ANNUAL, PROD_ID_WEEKLY } from '../billing/products';
import { PRIVACY_URL, TERMS_URL } from '../constants/Legal';
import { PermissionPrimer } from '../components/PermissionPrimer';
import type { RootStackParamList } from '../navigation/types';
import { askNotificationPermission, scheduleReminder } from '../permissions/reminders';
import { isPreviewDevice } from '../runtime/previewDevice';
import { grantPremium, markPaywallPassed } from '../storage/preferences';
import { colors, fonts, layout, shadow } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;
type PlanId = 'weekly' | 'annual';

const TRIAL_REMINDER_SECONDS = 24 * 60 * 60;

function purchaseWasCancelled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { userCancelled?: boolean | null; code?: string | number };
  if (record.userCancelled) return true;
  return record.code === '1' || record.code === 1;
}

function purchaseErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'The purchase did not go through.';
}

export function PaywallScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const posthog = usePostHog();
  const paywallViewed = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [plan, setPlan] = useState<PlanId>('annual');
  const [remind, setRemind] = useState(false);
  const [primer, setPrimer] = useState(false);
  const [cameraPrimer, setCameraPrimer] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [, setPremium] = useState(false);

  useEffect(() => {
    if (paywallViewed.current || !posthog) return;
    paywallViewed.current = true;
    try {
      posthog.capture('paywall_viewed');
    } catch {
      // A placeholder key must not take the screen down.
    }
  }, [posthog]);

  const continueAfterPay = () => {
    if (route.params.mode === 'single' && !route.params.imageUri) {
      navigation.replace('Studio');
      return;
    }
    navigation.replace('Trace', route.params);
  };

  const enterTrace = async () => {
    await markPaywallPassed();
    if (permission?.granted || isPreviewDevice()) {
      continueAfterPay();
      return;
    }
    setCameraPrimer(true);
  };

  const onRemind = (next: boolean) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (!next) {
      setRemind(false);
      setNotice(null);
      return;
    }
    setPrimer(true);
  };

  const confirmReminder = async () => {
    setPrimer(false);
    const granted = await askNotificationPermission();
    if (!granted) {
      setRemind(false);
      setNotice('Reminders stay off until you allow them.');
      return;
    }
    await scheduleReminder({
      seconds: TRIAL_REMINDER_SECONDS,
      title: 'Your free trial ends soon',
      body: 'Your ArtBlock trial finishes in 2 days. You can cancel anytime.',
    });
    setRemind(true);
    setNotice('We’ll remind you 2 days before the trial ends.');
  };

  const purchasePlan = async () => {
    if (purchasing) return;
    setPurchasing(true);
    setNotice(null);
    try {
      if (isPreviewDevice()) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await grantPremium();
        setPremium(true);
        await enterTrace();
        return;
      }

      const productId = plan === 'weekly' ? PROD_ID_WEEKLY : PROD_ID_ANNUAL;
      const purchases = await import('react-native-purchases');
      const Purchases = purchases.default;
      const offerings = await Purchases.getOfferings();
      const selected = offerings.current?.availablePackages.find(
        (item) => item.product.identifier === productId,
      );
      if (!selected) {
        throw new Error('No store product');
      }
      const result = await Purchases.purchasePackage(selected);
      if (!result.customerInfo.entitlements.active.pro) {
        Alert.alert('Purchase Error', 'ArtBlock Pro is not active on this purchase.');
        return;
      }
      await grantPremium();
      setPremium(true);
      try {
        posthog.capture('subscription_started', { package_id: selected.identifier });
      } catch {
        // A placeholder key must not take the screen down.
      }
      navigation.goBack();
    } catch (error) {
      if (purchaseWasCancelled(error)) return;
      Alert.alert('Purchase Error', purchaseErrorMessage(error));
    } finally {
      setPurchasing(false);
    }
  };

  const confirmCamera = async () => {
    setCameraPrimer(false);
    if (isPreviewDevice()) {
      continueAfterPay();
      return;
    }
    const result = permission?.granted ? permission : await requestPermission();
    continueAfterPay();
    if (!result.granted) return;
  };

  const choose = (next: PlanId) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setPlan(next);
    if (next === 'weekly') {
      setRemind(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}
      >
      <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.close}>
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
      <Text style={styles.kicker}>Premium</Text>
      <Text style={styles.title}>Keep every idea you spin</Text>
      <Text style={styles.support}>
        Your first trace is free. Unlock the mixer, photo import, and the camera whenever you want
        to draw again.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: plan === 'annual' }}
        onPress={() => choose('annual')}
        style={[styles.card, plan === 'annual' && styles.cardOn]}
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Most Popular</Text>
        </View>
        <Text style={styles.cardTitle}>Annual</Text>
        <Text style={styles.price}>$29.99 / year</Text>
        <Text style={styles.cardMeta}>3-day free trial, then $29.99 / year</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: plan === 'weekly' }}
        onPress={() => choose('weekly')}
        style={[styles.card, plan === 'weekly' && styles.cardOn]}
      >
        <Text style={styles.cardTitle}>Weekly</Text>
        <Text style={styles.price}>$4.99 / week</Text>
        <Text style={styles.cardMeta}>Billed immediately. No free trial.</Text>
      </Pressable>

      {plan === 'annual' ? (
        <View style={styles.remindRow}>
          <View style={styles.remindCopy}>
            <Text style={styles.remindTitle}>Remind me before it ends</Text>
            <Text style={styles.remindBody}>
              We’ll send an alert 48 hours before your trial finishes so you’re always in control.
              No hidden charges. Cancel anytime with a tap.
            </Text>
          </View>
          <Switch
            value={remind}
            onValueChange={onRemind}
            trackColor={{ false: '#D1D1D6', true: colors.brand }}
            thumbColor={colors.white}
            accessibilityLabel="Remind me before the trial ends"
          />
        </View>
      ) : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.spacer} />
      <Pressable
        accessibilityRole="button"
        disabled={purchasing}
        onPress={() => void purchasePlan()}
        style={({ pressed }) => [styles.primary, purchasing && styles.disabled, pressed && !purchasing && styles.pressed]}
      >
        <Text style={styles.primaryText}>
          {purchasing
            ? 'Working…'
            : plan === 'annual'
              ? 'Start 3-day free trial'
              : 'Subscribe weekly'}
        </Text>
      </Pressable>
      <View style={styles.legalRow}>
        <TouchableOpacity accessibilityRole="link" accessibilityLabel="Terms of Use" onPress={() => void Linking.openURL(TERMS_URL)}>
          <Text style={styles.legalText}>Terms of Use</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="link" accessibilityLabel="Privacy Policy" onPress={() => void Linking.openURL(PRIVACY_URL)}>
          <Text style={styles.legalText}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.secure}>Secure checkout. Cancel anytime.</Text>

      <PermissionPrimer
        visible={primer}
        title="A reminder before it renews"
        body="Get a note 2 days before your free trial ends. This stays on your phone."
        confirmLabel="Allow reminders"
        onConfirm={() => void confirmReminder()}
        onDismiss={() => {
          setPrimer(false);
          setRemind(false);
        }}
      />
      <PermissionPrimer
        visible={cameraPrimer}
        title="Line art on your paper"
        body="ArtBlock uses your camera to project this line art directly onto your paper. Rest the phone on a glass so your hands can draw underneath."
        confirmLabel="Continue"
        onConfirm={() => void confirmCamera()}
        onDismiss={() => setCameraPrimer(false)}
      />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paywall,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  legalRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  legalText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#8E8E93',
    textDecorationLine: 'underline',
  },
  close: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  closeText: {
    fontFamily: fonts.headingBold,
    fontSize: 16,
    color: colors.white,
  },
  kicker: {
    marginTop: 8,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.brand,
  },
  title: {
    marginTop: 8,
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: colors.white,
  },
  support: {
    marginTop: 8,
    marginBottom: 18,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: '#C7C7CC',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 2,
    borderColor: colors.card,
    padding: 18,
    marginBottom: 12,
    ...shadow,
  },
  cardOn: {
    borderColor: colors.brand,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  badgeText: {
    fontFamily: fonts.headingBold,
    fontSize: 12,
    color: colors.white,
    letterSpacing: 0.3,
  },
  cardTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 18,
    color: colors.ink,
  },
  price: {
    marginTop: 4,
    fontFamily: fonts.heading,
    fontSize: 28,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  cardMeta: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  remindRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    padding: 16,
    ...shadow,
  },
  remindCopy: {
    flex: 1,
  },
  remindTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 16,
    color: colors.ink,
  },
  remindBody: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  notice: {
    marginTop: 10,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
  },
  spacer: {
    flex: 1,
    minHeight: 16,
  },
  primary: {
    height: layout.pillHeight,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: colors.white,
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  secure: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: '#C7C7CC',
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
