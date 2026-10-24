import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PRIVACY_URL, TERMS_URL } from '../constants/Legal';
import type { RootStackParamList } from '../navigation/types';
import { grantPremium, isPremium } from '../storage/preferences';
import { fonts } from '../theme/colors';

const paper = '#F8F9FD';
const hero = '#FF2D55';
const heroEnd = '#FF4B72';
const ink = '#111118';
const muted = '#8E8E93';
const card = '#FFFFFF';
const line = '#E5E5EA';

const premiumShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.05,
  shadowRadius: 12,
  elevation: 3,
} as const;

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
type IonName = keyof typeof Ionicons.glyphMap;

const ACCOUNT_ROWS: { icon: IonName; label: string; action: 'restore' | 'rate' }[] = [
  { icon: 'refresh', label: 'Restore Purchases', action: 'restore' },
  { icon: 'star', label: 'Rate on App Store', action: 'rate' },
];

const HELP_ROWS: { icon: IonName; label: string; action: 'feature' }[] = [
  { icon: 'bulb', label: 'Request a Feature', action: 'feature' },
];

const LEGAL_ROWS: { icon: IonName; label: string; action: 'privacy' | 'terms' }[] = [
  { icon: 'lock-closed', label: 'Privacy Policy', action: 'privacy' },
  { icon: 'document-text', label: 'Terms of Use', action: 'terms' },
];

const FEATURE_EMAIL = 'princemahlaba27@gmail.com';
const FEATURE_MAIL = `mailto:${FEATURE_EMAIL}?subject=${encodeURIComponent('ArtBlock Feature Request')}&body=${encodeURIComponent('Hi Khotso,\n\nI have a feature request for ArtBlock.\n')}`;

/** Empty until ArtBlock has a real App Store id. Never fill this with a placeholder number. */
const APP_STORE_ID = '';

export function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [premium, setPremium] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void isPremium().then((value) => {
        if (active) setPremium(value);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Studio');
  };

  const openUpgrade = () => {
    navigation.navigate('Paywall', {
      title: 'ArtBlock Pro',
      prompts: [],
      mode: 'single',
    });
  };

  const openManageSubscription = () => {
    void Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => setNotice('That page could not open.'));
  };

  const restorePurchases = async () => {
    setNotice(null);
    if (Platform.OS === 'web') {
      setNotice('Restore runs on your phone.');
      return;
    }
    try {
      const purchases = await import('react-native-purchases');
      const info = await purchases.default.restorePurchases();
      if (Object.keys(info.entitlements.active).length > 0) {
        await grantPremium();
        setPremium(true);
      }
    } catch {
      setNotice('Restore did not finish.');
    }
  };

  const rateApp = async () => {
    setNotice(null);
    try {
      const storeReview = await import('expo-store-review');
      if (await storeReview.isAvailableAsync()) {
        await storeReview.requestReview();
        return;
      }
    } catch {
      // The native prompt is unavailable, so the alert below is the fallback.
    }
    if (!APP_STORE_ID) {
      Alert.alert('Rate on App Store', 'ArtBlock does not have an App Store id yet.');
      return;
    }
    const url = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Rate on App Store', APP_STORE_ID);
    }
  };

  const requestFeature = async () => {
    setNotice(null);
    try {
      const canOpen = await Linking.canOpenURL(FEATURE_MAIL);
      if (!canOpen) {
        Alert.alert('Mail could not open', FEATURE_EMAIL);
        return;
      }
      await Linking.openURL(FEATURE_MAIL);
    } catch {
      Alert.alert('Mail could not open', FEATURE_EMAIL);
    }
  };

  const onRow = (action: string) => {
    if (action === 'restore') {
      void restorePurchases();
      return;
    }
    if (action === 'rate') {
      void rateApp();
      return;
    }
    if (action === 'feature') {
      void requestFeature();
      return;
    }
    if (action === 'privacy') {
      void Linking.openURL(PRIVACY_URL).catch(() => setNotice('That page could not open.'));
      return;
    }
    void Linking.openURL(TERMS_URL).catch(() => setNotice('That page could not open.'));
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={styles.back}>
          <Ionicons name="chevron-back" size={28} color={ink} />
        </TouchableOpacity>

        <LinearGradient colors={[hero, heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroTitle}>ArtBlock Pro</Text>
          <Text style={styles.heroSubtitle}>{premium ? 'ArtBlock Pro is active' : 'You are on the Free Plan'}</Text>
          {premium ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Manage Subscription" activeOpacity={0.7} onPress={openManageSubscription} style={styles.upgrade}>
              <Text style={styles.upgradeText}>Manage Subscription</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Upgrade Now" activeOpacity={0.7} onPress={openUpgrade} style={styles.upgrade}>
              <Text style={styles.upgradeText}>Upgrade Now</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        <View style={styles.card}>
          {ACCOUNT_ROWS.map((row, index) => (
            <SettingsRow
              key={row.label}
              icon={row.icon}
              label={row.label}
              last={index === ACCOUNT_ROWS.length - 1}
              onPress={() => onRow(row.action)}
            />
          ))}
        </View>

        <View style={styles.card}>
          {HELP_ROWS.map((row, index) => (
            <SettingsRow
              key={row.label}
              icon={row.icon}
              label={row.label}
              last={index === HELP_ROWS.length - 1}
              onPress={() => onRow(row.action)}
            />
          ))}
        </View>

        <View style={styles.group}>
          <Text style={styles.groupLabel}>Legal</Text>
          <View style={styles.card}>
            {LEGAL_ROWS.map((row, index) => (
              <SettingsRow
                key={row.label}
                icon={row.icon}
                label={row.label}
                last={index === LEGAL_ROWS.length - 1}
                onPress={() => onRow(row.action)}
              />
            ))}
          </View>
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </ScrollView>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  last,
  onPress,
}: {
  icon: IonName;
  label: string;
  last: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.6}
      onPress={onPress}
      style={[styles.row, !last && styles.rowRule]}
    >
      <Ionicons name={icon} size={22} color={ink} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: paper,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: card,
    ...premiumShadow,
  },
  hero: {
    borderRadius: 16,
    padding: 20,
  },
  heroTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: card,
  },
  heroSubtitle: {
    marginTop: 6,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: card,
  },
  upgrade: {
    marginTop: 20,
    height: 56,
    borderRadius: 28,
    backgroundColor: card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeText: {
    fontFamily: fonts.headingBold,
    fontSize: 17,
    color: hero,
  },
  card: {
    backgroundColor: card,
    borderRadius: 16,
    overflow: 'hidden',
    ...premiumShadow,
  },
  group: {
    gap: 8,
  },
  groupLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: muted,
    paddingHorizontal: 4,
  },
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowRule: {
    borderBottomWidth: 1,
    borderBottomColor: line,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.headingBold,
    fontSize: 16,
    color: ink,
  },
  notice: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: muted,
  },
});
