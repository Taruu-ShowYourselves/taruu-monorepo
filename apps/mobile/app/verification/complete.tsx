import { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withDelay,
  FadeIn,
  SlideInUp,
} from 'react-native-reanimated';
import Confetti from 'react-native-confetti';

export default function VerificationCompleteScreen() {
  const router = useRouter();
  const scale = useSharedValue(0);
  const checkmarkScale = useSharedValue(0);

  useEffect(() => {
    // Badge animation
    scale.value = withSequence(
      withDelay(200, withSpring(1.2, { damping: 8 })),
      withSpring(1, { damping: 10 })
    );

    // Checkmark animation
    checkmarkScale.value = withDelay(
      500,
      withSpring(1, { damping: 8 })
    );
  }, [scale, checkmarkScale]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkmarkScale.value }],
  }));

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        {/* Success badge */}
        <View className="items-center mb-8">
          <Animated.View
            style={badgeStyle}
            className="w-32 h-32 rounded-full bg-secondary-100 items-center justify-center"
          >
            <Animated.View style={checkmarkStyle}>
              <Ionicons name="checkmark-circle" size={80} color="#10B981" />
            </Animated.View>
          </Animated.View>
        </View>

        {/* Success message */}
        <Animated.Text
          entering={FadeIn.delay(400)}
          className="text-3xl font-heebo font-bold text-neutral-900 mb-3 text-center"
        >
          מזל טוב!
        </Animated.Text>

        <Animated.Text
          entering={FadeIn.delay(600)}
          className="text-lg font-assistant text-neutral-600 text-center mb-4"
        >
          השלמתם את תהליך אימות המגורים בהצלחה
        </Animated.Text>

        <Animated.View
          entering={SlideInUp.delay(800)}
          className="bg-secondary-50 rounded-2xl p-5 w-full mb-8"
        >
          <View className="flex-row-reverse items-center mb-3">
            <Ionicons name="shield-checkmark" size={24} color="#10B981" />
            <Text className="flex-1 text-base font-heebo font-semibold text-secondary-700 text-right mr-3">
              מה זה אומר?
            </Text>
          </View>
          <View className="space-y-2">
            <View className="flex-row-reverse items-start">
              <Ionicons name="checkmark" size={18} color="#10B981" />
              <Text className="flex-1 text-sm font-assistant text-secondary-700 text-right mr-2">
                אומתתם כתושבי העירייה
              </Text>
            </View>
            <View className="flex-row-reverse items-start">
              <Ionicons name="checkmark" size={18} color="#10B981" />
              <Text className="flex-1 text-sm font-assistant text-secondary-700 text-right mr-2">
                תוכלו להצביע בהצבעות עירוניות
              </Text>
            </View>
            <View className="flex-row-reverse items-start">
              <Ionicons name="checkmark" size={18} color="#10B981" />
              <Text className="flex-1 text-sm font-assistant text-secondary-700 text-right mr-2">
                תוכלו ליצור הצבעות חדשות
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={SlideInUp.delay(1000)} className="w-full">
          <Pressable
            className="bg-primary-600 py-4 rounded-xl items-center active:bg-primary-700"
            onPress={() => router.replace('/(tabs)')}
          >
            <Text className="text-white text-lg font-heebo font-semibold">
              צפו בהצבעות
            </Text>
          </Pressable>

          <Pressable
            className="mt-4 py-3 items-center"
            onPress={() => router.replace('/(tabs)/profile')}
          >
            <Text className="text-primary-600 font-heebo">לפרופיל שלי</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Stats */}
      <Animated.View
        entering={FadeIn.delay(1200)}
        className="px-5 pb-8"
      >
        <View className="bg-neutral-50 rounded-2xl p-5">
          <Text className="text-sm font-assistant text-neutral-500 text-right mb-3">
            סיכום האימות
          </Text>
          <View className="flex-row-reverse justify-between">
            <View className="items-center">
              <Text className="text-2xl font-heebo font-bold text-primary-600">21</Text>
              <Text className="text-xs font-assistant text-neutral-500">ימים</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-heebo font-bold text-secondary-600">✓</Text>
              <Text className="text-xs font-assistant text-neutral-500">צ'ק-אינים</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-heebo font-bold text-accent-600">100%</Text>
              <Text className="text-xs font-assistant text-neutral-500">הצלחה</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
