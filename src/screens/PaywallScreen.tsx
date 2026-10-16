import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCameraPermissions } from 'expo-camera';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PROD_ID_ANNUAL, PROD_ID_WEEKLY } from '../billing/products';
import { PermissionPrimer } from '../components/PermissionPrimer';
import type { RootStackParamList } from '../navigation/types';
import { askNotificationPermission, scheduleReminder } from '../permissions/reminders';
import { grantPremium, markPaywallPassed } from '../storage/preferences';
import { colors, layout } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;
type PlanId = 'weekly' | 'annual';

const TRIAL_REMINDER_SECONDS = 24 * 60 * 60;

export function PaywallScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [plan, setPlan] = useState<PlanId>('weekly');
  const [remind, setRemind] = useState(false);
  const [primer, setPrimer] = useState(false);
  const [cameraPrimer, setCameraPrimer] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const enterTrace = async () => {
    await markPaywallPassed();
    if (permission?.granted) {
      navigation.replace('Trace', route.params);
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
      if (!Device.isDevice) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await grantPremium();
        await enterTrace();
        return;
      }

      const productId = plan === 'weekly' ? PROD_ID_WEEKLY : PROD_ID_ANNUAL;
      try {
        const purchases = await import('react-native-purchases');
        const Purchases = purchases.default;
        const offerings = await Purchases.getOfferings();
        const selected = offerings.current?.availablePackages.find(
          (item) => item.product.identifier === productId,
        );
        if (!selected) {
          throw new Error('No store product');
        }
        await Purchases.purchasePackage(selected);
        await grantPremium();
        await enterTrace();
      } catch {
        setNotice('The purchase did not go through.');
      }
    } catch {
      setNotice('The purchase did not go through.');
    } finally {
      setPurchasing(false);
    }
  };

  const confirmCamera = async () => {
    setCameraPrimer(false);
    const result = permission?.granted ? permission : await requestPermission();
    navigation.replace('Trace', route.params);
    if (!result.granted) return;
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.title}>Unlock your 30-day sketch path</Text>
      <Text style={styles.support}>Weekly is $4.99 with a 3-day trial. A year is $29.99.</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: plan === 'weekly' }}
        onPress={() => setPlan('weekly')}
        style={[styles.card, plan === 'weekly' && styles.cardOn]}
      >
        <Text style={styles.cardTitle}>Weekly</Text>
        <Text style={styles.price}>$4.99</Text>
        <Text style={styles.cardMeta}>3 days free, then $4.99 a week</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: plan === 'annual' }}
        onPress={() => setPlan('annual')}
        style={[styles.card, plan === 'annual' && styles.cardOn]}
      >
        <Text style={styles.cardTitle}>Annual</Text>
        <Text style={styles.price}>$29.99</Text>
        <Text style={styles.cardMeta}>A full year of ideas and tracing</Text>
      </Pressable>

      <View style={styles.remindRow}>
        <View style={styles.remindCopy}>
          <Text style={styles.remindTitle}>Remind me before it ends</Text>
          <Text style={styles.remindBody}>
            We’ll send an alert 48 hours before your trial finishes so you’re always in control. No
            hidden charges. Cancel anytime with a tap.
          </Text>
        </View>
        <Switch
          value={remind}
          onValueChange={onRemind}
          trackColor={{ false: colors.stroke, true: colors.brand }}
          thumbColor={colors.canvas}
          accessibilityLabel="Remind me before the trial ends"
        />
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.spacer} />
      <Pressable
        accessibilityRole="button"
        disabled={purchasing}
        onPress={() => void purchasePlan()}
        style={({ pressed }) => [styles.primary, purchasing && styles.disabled, pressed && !purchasing && styles.pressed]}
      >
        <Text style={styles.primaryText}>
          {plan === 'weekly' ? 'Start 3-day trial' : 'Continue with the year'}
        </Text>
      </Pressable>

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.ink,
  },
  support: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 16,
    marginBottom: 12,
  },
  cardOn: {
    borderColor: colors.brand,
    borderWidth: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  price: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.ink,
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  remindRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 16,
  },
  remindCopy: {
    flex: 1,
  },
  remindTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  remindBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  notice: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  spacer: {
    flex: 1,
  },
  primary: {
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
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
