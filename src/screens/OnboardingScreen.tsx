import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { usePostHog } from 'posthog-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PROD_ID_ANNUAL, PROD_ID_WEEKLY } from '../billing/products';
import { PRIVACY_URL, TERMS_URL } from '../constants/Legal';
import type { RootStackParamList } from '../navigation/types';
import { isPreviewDevice } from '../runtime/previewDevice';
import { grantPremium } from '../storage/preferences';
import { fonts } from '../theme/colors';

const hero = '#FF2D55';
const ink = '#111118';
const muted = '#8E8E93';
const card = '#FFFFFF';
const paper = '#F8F9FD';
const inactive = '#E5E5EA';
const secondary = '#F2F3F8';
const gold = '#FFD60A';
const activeFill = '#FFE5EA';
const PAYWALL_PHOTO = 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800';
const LOADER_START = 'Analyzing your profile...';
const LOADER_READY =
  'Your Custom Studio is Ready. 85% of beginners using this setup complete their first aesthetic trace in under 10 minutes.';

const premiumShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.05,
  shadowRadius: 12,
  elevation: 3,
} as const;

const GOALS = ['Learn to draw', 'Do Pinterest/TikTok trends', 'Cure art block'] as const;
const SKILLS = ['Complete Beginner', 'I doodle occasionally', 'Advanced Artist'] as const;
const SURFACES = ['Sketchbook', 'Plain Paper', 'Canvas', 'Digital'] as const;

type PlanId = 'annual' | 'weekly';
type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const PLANS: { id: PlanId; name: string; price: string; detail: string; badge?: string }[] = [
  {
    id: 'annual',
    name: 'Annual',
    price: '$29.99',
    detail: '3-day free trial, then $29.99 / year',
    badge: 'Most Popular',
  },
  {
    id: 'weekly',
    name: 'Weekly',
    price: '$4.99',
    detail: 'Billed immediately. No free trial.',
  },
];

function SpinningRing() {
  const turn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return <Animated.View accessibilityLabel="Loading" style={[styles.ring, { transform: [{ rotate }] }]} />;
}

export function OnboardingScreen({ navigation }: Props) {
  const posthog = usePostHog();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const pageRef = useRef(0);
  const goalRef = useRef<string | null>(null);
  const skillRef = useRef<string | null>(null);
  const surfaceRef = useRef<string | null>(null);
  const moving = useRef(false);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [page, setPage] = useState(0);
  const [goal, setGoal] = useState<string | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const [surface, setSurface] = useState<string | null>(null);
  const [loaderCopy, setLoaderCopy] = useState(LOADER_START);
  const [plan, setPlan] = useState<PlanId>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const width = frame.width;
  const paywall = page === 5;
  const loader = page === 4;
  const continueLocked =
    (page === 1 && !goal) || (page === 2 && !skill) || (page === 3 && !surface);
  const pillLabel = paywall ? 'Start 3-day free trial' : 'Continue';

  const clamp = (index: number) => {
    if (!goalRef.current && index > 1) return 1;
    if (!skillRef.current && index > 2) return 2;
    if (!surfaceRef.current && index > 3) return 3;
    return Math.min(5, Math.max(0, index));
  };

  const showPage = (next: number) => {
    pageRef.current = next;
    setPage(next);
  };

  const goTo = (index: number) => {
    const next = clamp(index);
    moving.current = true;
    showPage(next);
    scroller.current?.scrollTo({ x: width * next, animated: false });
    requestAnimationFrame(() => {
      moving.current = false;
    });
  };

  useEffect(() => {
    try {
      posthog.capture('onboarding_step_viewed', { step: page });
      if (page === 5) posthog.capture('paywall_viewed');
    } catch {
      // A placeholder key must not take the screen down.
    }
  }, [page, posthog]);

  useEffect(() => {
    if (page !== 4 || !width) return;
    setLoaderCopy(LOADER_START);
    const copyTimer = setTimeout(() => setLoaderCopy(LOADER_READY), 1500);
    const advanceTimer = setTimeout(() => {
      moving.current = true;
      pageRef.current = 5;
      setPage(5);
      scroller.current?.scrollTo({ x: width * 5, animated: false });
      requestAnimationFrame(() => {
        moving.current = false;
      });
    }, 3000);
    return () => {
      clearTimeout(copyTimer);
      clearTimeout(advanceTimer);
    };
  }, [page, width]);

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width || moving.current) return;
    const next = clamp(Math.round(event.nativeEvent.contentOffset.x / width));
    if (next * width !== event.nativeEvent.contentOffset.x) {
      scroller.current?.scrollTo({ x: width * next, animated: false });
    }
    showPage(next);
  };

  const chooseGoal = (name: string) => {
    goalRef.current = name;
    setGoal(name);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const chooseSkill = (name: string) => {
    skillRef.current = name;
    setSkill(name);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const chooseSurface = (name: string) => {
    surfaceRef.current = name;
    setSurface(name);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const choosePlan = (next: PlanId) => {
    setPlan(next);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const finishPaywall = async () => {
    if (purchasing) return;
    setPurchasing(true);
    setNotice(null);
    try {
      if (isPreviewDevice()) {
        await grantPremium();
        navigation.reset({ index: 0, routes: [{ name: 'Studio' }] });
        return;
      }
      const productId = plan === 'weekly' ? PROD_ID_WEEKLY : PROD_ID_ANNUAL;
      try {
        const purchases = await import('react-native-purchases');
        const Purchases = purchases.default;
        const offerings = await Purchases.getOfferings();
        const selected = offerings.current?.availablePackages.find((item) => item.product.identifier === productId);
        if (!selected) throw new Error('No store product');
        await Purchases.purchasePackage(selected);
        try {
          posthog.capture('subscription_started', { package_id: selected.identifier });
        } catch {
          // A placeholder key must not take the screen down.
        }
        await grantPremium();
        navigation.reset({ index: 0, routes: [{ name: 'Studio' }] });
      } catch {
        setNotice('The purchase did not go through.');
      }
    } catch {
      setNotice('The purchase did not go through.');
    } finally {
      setPurchasing(false);
    }
  };

  const onPrimary = () => {
    const current = pageRef.current;
    if (current === 5) {
      try {
        posthog.capture('paywall_action', { action_type: 'trial_started' });
      } catch {
        // A placeholder key must not take the screen down.
      }
      void finishPaywall();
      return;
    }
    if (current === 1 && !goalRef.current) return;
    if (current === 2 && !skillRef.current) return;
    if (current === 3 && !surfaceRef.current) return;
    goTo(current + 1);
  };

  const cardWidth = Math.min(Math.max(width - 48, 0), 440);
  const tile = Math.floor((cardWidth - 48 - 12) / 2);

  const leaveToStudio = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Studio' }] });
  };

  return (
    <View
      style={[styles.screen, paywall && styles.screenDark]}
      onLayout={(event) => {
        const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
        setFrame((current) =>
          current.width === nextWidth && current.height === nextHeight ? current : { width: nextWidth, height: nextHeight },
        );
      }}
    >
      <View
        style={styles.pagerSlot}
        onLayout={(event) => {
          const nextHeight = event.nativeEvent.layout.height;
          setFrame((current) => (current.height === nextHeight ? current : { ...current, height: nextHeight }));
        }}
      >
        {width > 0 ? (
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            bounces={false}
            decelerationRate="fast"
            disableIntervalMomentum
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumScrollEnd}
            scrollEventThrottle={16}
            testID="welcome-pager"
            style={styles.pager}
            contentContainerStyle={styles.pagerContent}
          >
            <View style={{ width, height: frame.height }}>
              <Image source={require('../../assets/onboarding-hero.png')} style={{ width: '100%', height: 400, backgroundColor: '#111118' }} resizeMode="cover" />
              <View style={styles.copy}>
                <Text style={styles.heading}>Draw anything. No talent needed.</Text>
                <Text style={styles.subtitle}>Trace viral TikTok aesthetics directly onto real paper.</Text>
              </View>
            </View>

            <View style={[styles.surveyPage, { width, height: frame.height, paddingTop: insets.top + 16 }]}>
              <View style={[styles.surveyCard, { width: cardWidth }]}>
                <Text style={styles.heading}>What is your main goal?</Text>
                <View style={styles.choiceList}>
                  {GOALS.map((item) => {
                    const selected = goal === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        accessibilityRole="button"
                        accessibilityLabel={item}
                        accessibilityState={{ selected }}
                        activeOpacity={0.6}
                        onPress={() => chooseGoal(item)}
                        style={[styles.secondary, selected && styles.secondaryOn]}
                      >
                        <Text style={styles.secondaryText}>{item}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={[styles.surveyPage, { width, height: frame.height, paddingTop: insets.top + 16 }]}>
              <View style={[styles.surveyCard, { width: cardWidth }]}>
                <Text style={styles.heading}>What's your skill level?</Text>
                <View style={styles.choiceList}>
                  {SKILLS.map((item) => {
                    const selected = skill === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        accessibilityRole="button"
                        accessibilityLabel={item}
                        accessibilityState={{ selected }}
                        activeOpacity={0.6}
                        onPress={() => chooseSkill(item)}
                        style={[styles.secondary, selected && styles.secondaryOn]}
                      >
                        <Text style={styles.secondaryText}>{item}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={[styles.surveyPage, { width, height: frame.height, paddingTop: insets.top + 16 }]}>
              <View style={[styles.surveyCard, { width: cardWidth }]}>
                <Text style={styles.heading}>What do you prefer to draw on?</Text>
                <View style={styles.surfaceGrid}>
                  {SURFACES.map((item) => {
                    const selected = surface === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        accessibilityRole="button"
                        accessibilityLabel={item}
                        accessibilityState={{ selected }}
                        activeOpacity={0.6}
                        onPress={() => chooseSurface(item)}
                        style={[styles.surface, { width: tile, height: tile }, selected && styles.surfaceOn]}
                      >
                        <Text style={styles.surfaceText}>{item}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={[styles.step, styles.centerStep, { width, height: frame.height }]}>
              <SpinningRing />
              <Text style={styles.loaderText}>{loaderCopy}</Text>
            </View>

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              style={[styles.stepDark, { width, height: frame.height }]}
              contentContainerStyle={styles.paywallScroll}
            >
              <Image accessibilityLabel="Hands holding a drawing" source={{ uri: PAYWALL_PHOTO }} resizeMode="cover" style={{ width, height: Math.round(windowHeight * 0.28) }} />
              <View style={styles.paywallBody}>
                {PLANS.map((item) => {
                  const selected = plan === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={item.name}
                      accessibilityState={{ selected }}
                      onPress={() => choosePlan(item.id)}
                      style={[styles.tier, selected ? styles.tierOn : styles.tierOff]}
                    >
                      <View style={styles.tierTop}>
                        <Text style={styles.tierName}>{item.name}</Text>
                        {item.badge ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{item.badge}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.tierPrice}>{item.price}</Text>
                      <Text style={styles.tierDetail}>{item.detail}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.paywallSpacer} />
              <View style={styles.paywallActions}>
                {notice ? <Text style={styles.notice}>{notice}</Text> : null}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Start 3-day free trial"
                  accessibilityState={{ disabled: purchasing }}
                  activeOpacity={0.7}
                  disabled={purchasing}
                  hitSlop={15}
                  onPress={onPrimary}
                  style={[styles.pill, purchasing && styles.pillOff]}
                >
                  <Text style={styles.pillText}>Start 3-day free trial</Text>
                </TouchableOpacity>
                <View style={styles.legalRow}>
                  <TouchableOpacity accessibilityRole="link" accessibilityLabel="Terms of Use" onPress={() => void Linking.openURL(TERMS_URL)}>
                    <Text style={styles.legalText}>Terms of Use</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="link" accessibilityLabel="Privacy Policy" onPress={() => void Linking.openURL(PRIVACY_URL)}>
                    <Text style={styles.legalText}>Privacy Policy</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Skip and use my 1 free trace"
                  activeOpacity={0.7}
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                  onPress={() => {
                    try {
                      posthog.capture('paywall_action', { action_type: 'skipped_for_free_trace' });
                    } catch {
                      // A placeholder key must not take the screen down.
                    }
                    leaveToStudio();
                  }}
                  style={styles.skip}
                >
                  <Text style={styles.skipText}>Skip and use my 1 free trace</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </ScrollView>
        ) : null}
      </View>

      {paywall ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={leaveToStudio}
          style={styles.close}
        >
          <Text style={styles.closeMark}>×</Text>
        </Pressable>
      ) : null}

      {loader || paywall ? null : (
        <View style={[styles.continueWrap, { bottom: Math.max(40, insets.bottom) }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={pillLabel}
            accessibilityState={{ disabled: continueLocked || purchasing }}
            activeOpacity={0.7}
            disabled={continueLocked || purchasing}
            hitSlop={15}
            onPress={onPrimary}
            style={[styles.pill, (continueLocked || purchasing) && styles.pillOff]}
          >
            <Text style={styles.pillText}>{pillLabel}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: paper,
  },
  screenDark: {
    backgroundColor: ink,
  },
  pagerSlot: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  pagerContent: {
    flexDirection: 'row',
  },
  copy: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  step: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  surveyPage: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surveyCard: {
    backgroundColor: card,
    borderRadius: 24,
    padding: 24,
    ...premiumShadow,
  },
  close: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: card,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...premiumShadow,
  },
  closeMark: {
    fontFamily: fonts.headingBold,
    fontSize: 22,
    lineHeight: 24,
    color: ink,
  },
  skip: {
    marginTop: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: muted,
  },
  stepDark: {
    backgroundColor: ink,
  },
  centerStep: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontFamily: fonts.headingBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: ink,
  },
  centerText: {
    textAlign: 'center',
    marginTop: 16,
  },
  subtitle: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: muted,
  },
  choiceList: {
    marginTop: 22,
    gap: 12,
  },
  secondary: {
    height: 52,
    borderRadius: 24,
    backgroundColor: secondary,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryOn: {
    backgroundColor: activeFill,
    borderColor: hero,
  },
  secondaryText: {
    fontFamily: fonts.headingBold,
    fontSize: 17,
    color: ink,
  },
  surfaceGrid: {
    marginTop: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  surface: {
    borderRadius: 16,
    backgroundColor: secondary,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  surfaceOn: {
    backgroundColor: activeFill,
    borderColor: hero,
  },
  surfaceText: {
    fontFamily: fonts.headingBold,
    fontSize: 17,
    letterSpacing: -0.5,
    color: ink,
    textAlign: 'center',
  },
  ring: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 6,
    borderColor: hero,
    borderTopColor: 'transparent',
    backgroundColor: 'transparent',
  },
  loaderText: {
    marginTop: 22,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: muted,
    textAlign: 'center',
  },
  paywallScroll: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  paywallBody: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  paywallSpacer: {
    flexGrow: 1,
    minHeight: 16,
  },
  paywallActions: {
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
  tier: {
    backgroundColor: card,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    ...premiumShadow,
  },
  tierOn: {
    borderWidth: 2,
    borderColor: hero,
  },
  tierOff: {
    borderWidth: 1.5,
    borderColor: inactive,
  },
  tierTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tierName: {
    fontFamily: fonts.headingBold,
    fontSize: 17,
    letterSpacing: -0.5,
    color: ink,
  },
  tierPrice: {
    marginTop: 6,
    fontFamily: fonts.headingBold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: ink,
  },
  tierDetail: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 18,
    color: muted,
  },
  badge: {
    backgroundColor: gold,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: fonts.headingBold,
    fontSize: 11,
    color: ink,
  },
  continueWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 3,
  },
  notice: {
    marginBottom: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  noticeDark: {
    color: ink,
  },
  pill: {
    height: 56,
    borderRadius: 28,
    backgroundColor: hero,
    alignItems: 'center',
    justifyContent: 'center',
    ...premiumShadow,
  },
  pillOff: {
    opacity: 0.4,
  },
  pillText: {
    fontFamily: fonts.headingBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
});
