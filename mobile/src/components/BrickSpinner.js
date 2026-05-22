import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { colors } from '../theme';

const BrickSpinner = ({ size = 'large', color = colors.primary, style }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Small spinner rotation
  useEffect(() => {
    if (size === 'small') {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [size]);

  if (size === 'small') {
    const rotate = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <Animated.View
        style={[
          styles.brick,
          { width: 20, height: 10, backgroundColor: color },
          style,
          { transform: [{ rotate }] },
        ]}
      />
    );
  }

  // Large Spinner: Premium Forklift Animation!
  return <ForkliftSpinner color={color} style={style} />;
};

const ForkliftSpinner = ({ color, style }) => {
  const driveAnim = useRef(new Animated.Value(0)).current;
  const liftAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Loop travel & wheel spin (6 seconds per full roundtrip)
    Animated.loop(
      Animated.timing(driveAnim, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Loop fork lifting (3.6 seconds per full loop)
    Animated.loop(
      Animated.sequence([
        Animated.timing(liftAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(liftAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Travel position: Drives from -160 to 160 on a fixed track
  const translateX = driveAnim.interpolate({
    inputRange: [0, 0.45, 0.5, 0.95, 1],
    outputRange: [-160, 160, 160, -160, -160],
  });

  // Flips direction of the forklift to match travel
  const scaleX = driveAnim.interpolate({
    inputRange: [0, 0.45, 0.46, 0.95, 0.96, 1],
    outputRange: [1, 1, -1, -1, 1, 1],
  });

  // Wheel rotation directions (clockwise when driving right, CCW when driving left)
  const wheelRotate = driveAnim.interpolate({
    inputRange: [0, 0.45, 0.5, 0.95, 1],
    outputRange: ['0deg', '1440deg', '1440deg', '0deg', '0deg'],
  });

  // Lift height for prongs and cargo
  const forkTranslateY = liftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  });

  return (
    <View style={[styles.forkliftContainer, style]}>
      <Animated.View
        style={[
          styles.forklift,
          { transform: [{ translateX }, { scaleX }] },
        ]}
      >
        {/* Rear Counterweight */}
        <View style={styles.counterweight} />

        {/* Cabin Body Frame */}
        <View style={[styles.cabin, { borderColor: color }]}>
          {/* Inner window window */}
          <View style={styles.window} />
          {/* Cabin interior detailing */}
          <View style={styles.details} />
        </View>

        {/* Base Chassis Plate */}
        <View style={[styles.chassis, { backgroundColor: color }]} />

        {/* Mast Guide Rail */}
        <View style={styles.mast} />

        {/* Animated Fork Carriage & Branded Cargo Brick */}
        <Animated.View
          style={[
            styles.forkCarriage,
            { transform: [{ translateY: forkTranslateY }] },
          ]}
        >
          {/* Realistic L-shaped Steel Fork */}
          <View style={styles.forkVertical} />
          <View style={styles.forkHorizontal} />
          {/* Cargo Brick being carried */}
          <View style={[styles.cargoBrick, { backgroundColor: color }]}>
            <View style={styles.cargoLine1} />
            <View style={styles.cargoLine2} />
          </View>
        </Animated.View>

        {/* Front Drive Wheel (Larger) */}
        <View style={[styles.wheelContainer, styles.frontWheel]}>
          <Animated.View
            style={[
              styles.wheelSpokes,
              { transform: [{ rotate: wheelRotate }] },
            ]}
          >
            <View style={styles.wheelSpokeH} />
            <View style={styles.wheelSpokeV} />
          </Animated.View>
        </View>

        {/* Rear Steer Wheel (Smaller) */}
        <View style={[styles.wheelContainer, styles.rearWheel]}>
          <Animated.View
            style={[
              styles.wheelSpokes,
              { transform: [{ rotate: wheelRotate }] },
            ]}
          >
            <View style={styles.wheelSpokeH} />
            <View style={styles.wheelSpokeV} />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  brick: {
    borderRadius: 3,
  },
  forkliftContainer: {
    width: '100%',
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginVertical: 10,
  },

  forklift: {
    width: 80,
    height: 60,
    position: 'absolute',
    bottom: 22,
    flexDirection: 'row',
  },
  cabin: {
    width: 44,
    height: 32,
    borderWidth: 3.5,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 6,
    position: 'absolute',
    bottom: 12,
    left: 12,
  },
  window: {
    width: 18,
    height: 12,
    backgroundColor: '#1E293B',
    position: 'absolute',
    top: 2,
    left: 14,
    borderTopRightRadius: 3,
  },
  details: {
    width: 4,
    height: 8,
    backgroundColor: '#475569',
    position: 'absolute',
    bottom: 2,
    left: 26,
    borderRadius: 1,
  },
  counterweight: {
    width: 12,
    height: 20,
    backgroundColor: '#334155',
    position: 'absolute',
    bottom: 12,
    left: 0,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  chassis: {
    width: 52,
    height: 10,
    position: 'absolute',
    bottom: 12,
    left: 8,
    borderRadius: 2,
  },
  mast: {
    width: 3.5,
    height: 48,
    backgroundColor: '#475569',
    position: 'absolute',
    bottom: 12,
    left: 60,
    borderRadius: 1,
  },
  forkCarriage: {
    position: 'absolute',
    bottom: 12,
    left: 61,
    width: 32,
    height: 28,
  },
  forkVertical: {
    width: 3,
    height: 18,
    backgroundColor: '#64748B', // Steel grey backplate
    position: 'absolute',
    bottom: 0,
    left: 4,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  forkHorizontal: {
    width: 24,
    height: 3,
    backgroundColor: '#475569', // Dark steel grey prong
    position: 'absolute',
    bottom: 0,
    left: 4,
    borderBottomRightRadius: 2,
    borderTopRightRadius: 0.5,
  },
  cargoBrick: {
    width: 18,
    height: 18,
    borderRadius: 3,
    position: 'absolute',
    bottom: 3,
    left: 7, // Sitting snug against the vertical backplate (left: 4 + width: 3)
    padding: 2,
    justifyContent: 'center',
    gap: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 1,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cargoLine1: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 1,
  },
  cargoLine2: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 1,
    width: '70%',
  },
  wheelContainer: {
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: '#64748B',
  },
  frontWheel: {
    width: 18,
    height: 18,
    borderRadius: 9,
    position: 'absolute',
    bottom: 3,
    left: 46,
  },
  rearWheel: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    bottom: 3,
    left: 8,
  },
  wheelSpokes: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelSpokeH: {
    width: '80%',
    height: 1.5,
    backgroundColor: '#94A3B8',
    position: 'absolute',
  },
  wheelSpokeV: {
    width: 1.5,
    height: '80%',
    backgroundColor: '#94A3B8',
    position: 'absolute',
  },
});

export default BrickSpinner;