import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

import { colors, fonts, layout, shadow } from '../theme/colors';

type BeforeAfterSliderProps = {
  svg: string;
  photoUri: string;
};

export function BeforeAfterSlider({ svg, photoUri }: BeforeAfterSliderProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const width = useSharedValue(0);
  const split = useSharedValue(0.5);

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-16, 16])
    .onUpdate((event) => {
      const frame = width.value;
      if (frame <= 0) return;
      const next = event.x / frame;
      split.value = Math.min(0.94, Math.max(0.06, next));
    });

  const clipStyle = useAnimatedStyle(() => ({
    width: split.value * width.value,
  }));

  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: split.value * width.value - 18 }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityLabel="Compare the line art and your photo"
        accessibilityHint="Drag sideways"
        style={styles.frame}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          const nextHeight = event.nativeEvent.layout.height;
          width.value = nextWidth;
          setSize((current) =>
            current.width === nextWidth && current.height === nextHeight
              ? current
              : { width: nextWidth, height: nextHeight },
          );
        }}
      >
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <Animated.View style={[styles.clip, clipStyle]}>
          <View style={[styles.stencil, { width: size.width, height: size.height }]}>
            {size.width > 0 ? (
              <SvgXml xml={svg} width={size.width} height={size.height} />
            ) : null}
          </View>
        </Animated.View>
        <View pointerEvents="none" style={styles.labels}>
          <Text style={styles.lineLabel}>Line art</Text>
          <Text style={styles.photoLabel}>Your photo</Text>
        </View>
        <Animated.View pointerEvents="none" style={[styles.handle, handleStyle]}>
          <View style={styles.handleLine} />
          <View style={styles.knob}>
            <Text style={styles.knobText}>↔</Text>
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 440,
    borderRadius: layout.cardRadius,
    overflow: 'hidden',
    backgroundColor: colors.ink,
    ...shadow,
  },
  clip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  stencil: {
    backgroundColor: colors.card,
  },
  labels: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lineLabel: {
    backgroundColor: colors.card,
    color: colors.ink,
    overflow: 'hidden',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontFamily: fonts.headingBold,
    fontSize: 12,
  },
  photoLabel: {
    backgroundColor: colors.hud,
    color: colors.white,
    overflow: 'hidden',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontFamily: fonts.headingBold,
    fontSize: 12,
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
  },
  handleLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.canvas,
  },
  knob: {
    marginTop: 200,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobText: {
    color: colors.white,
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
});
