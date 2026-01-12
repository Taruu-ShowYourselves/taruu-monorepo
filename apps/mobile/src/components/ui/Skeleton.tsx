import { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Animated skeleton loading placeholder
 */
export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const shimmerValue = useSharedValue(0);

  useEffect(() => {
    shimmerValue.value = withRepeat(
      withTiming(1, {
        duration: 1500,
        easing: Easing.ease,
      }),
      -1,
      false
    );
  }, [shimmerValue]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(shimmerValue.value, [0, 0.5, 1], [0.3, 0.7, 0.3]);
    return {
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: typeof width === 'number' ? width : undefined,
          height,
          borderRadius,
          backgroundColor: '#E5E7EB',
        },
        typeof width === 'string' && { width },
        animatedStyle,
        style,
      ]}
    />
  );
}

/**
 * Skeleton for a text line
 */
export function SkeletonText({
  width = '100%',
  height = 16,
  style,
}: SkeletonProps) {
  return <Skeleton width={width} height={height} borderRadius={4} style={style} />;
}

/**
 * Skeleton for a circular avatar
 */
export function SkeletonAvatar({ size = 48 }: { size?: number }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} />;
}

/**
 * Skeleton for a card layout
 */
export function SkeletonCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <SkeletonAvatar size={40} />
        <View style={styles.cardHeaderText}>
          <SkeletonText width="60%" height={14} />
          <SkeletonText width="40%" height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <SkeletonText height={14} style={{ marginTop: 12 }} />
      <SkeletonText width="80%" height={14} style={{ marginTop: 8 }} />
      <SkeletonText width="50%" height={14} style={{ marginTop: 8 }} />
    </View>
  );
}

/**
 * Skeleton for a vote card
 */
export function SkeletonVoteCard() {
  return (
    <View style={styles.voteCard}>
      <SkeletonText width="80%" height={18} />
      <SkeletonText width="100%" height={14} style={{ marginTop: 8 }} />
      <SkeletonText width="60%" height={14} style={{ marginTop: 4 }} />
      <View style={styles.voteCardFooter}>
        <Skeleton width={80} height={24} borderRadius={12} />
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>
    </View>
  );
}

/**
 * Skeleton for a list of items
 */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} style={{ marginBottom: 12 }} />
      ))}
    </View>
  );
}

/**
 * Skeleton for profile screen
 */
export function SkeletonProfile() {
  return (
    <View style={styles.profile}>
      <View style={styles.profileHeader}>
        <SkeletonAvatar size={80} />
        <SkeletonText width={150} height={20} style={{ marginTop: 12 }} />
        <SkeletonText width={200} height={14} style={{ marginTop: 6 }} />
      </View>
      <View style={styles.profileStats}>
        <View style={styles.profileStat}>
          <Skeleton width={60} height={30} borderRadius={8} />
          <SkeletonText width={50} height={12} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.profileStat}>
          <Skeleton width={60} height={30} borderRadius={8} />
          <SkeletonText width={50} height={12} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.profileStat}>
          <Skeleton width={60} height={30} borderRadius={8} />
          <SkeletonText width={50} height={12} style={{ marginTop: 4 }} />
        </View>
      </View>
    </View>
  );
}

/**
 * Skeleton for identity score card
 */
export function SkeletonIdentityScore() {
  return (
    <View style={styles.identityCard}>
      <View style={styles.identityHeader}>
        <SkeletonText width={100} height={18} />
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>
      <View style={styles.identityProgress}>
        <Skeleton width="100%" height={10} borderRadius={5} />
      </View>
      <SkeletonText width="80%" height={12} style={{ marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginRight: 12,
    alignItems: 'flex-end',
  },
  voteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  voteCardFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  profile: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  profileHeader: {
    alignItems: 'center',
  },
  profileStats: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  profileStat: {
    alignItems: 'center',
  },
  identityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  identityHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  identityProgress: {
    marginBottom: 8,
  },
});

export default Skeleton;
