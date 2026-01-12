import { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    paymentId: string;
    amount: string;
    type: string;
    voteId: string;
  }>();

  const scale = useSharedValue(0);
  const checkmarkScale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withDelay(200, withSpring(1.2, { damping: 8 })),
      withSpring(1, { damping: 10 })
    );

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

  const isVoteParticipation = params.type === 'vote_participation';
  const amount = parseInt(params.amount || '0', 10);

  const handleContinue = () => {
    if (isVoteParticipation && params.voteId) {
      // Go back to vote detail to complete the vote
      router.replace(`/vote/${params.voteId}`);
    } else {
      // Go to dashboard
      router.replace('/(tabs)');
    }
  };

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
          התשלום הושלם!
        </Animated.Text>

        <Animated.Text
          entering={FadeIn.delay(600)}
          className="text-lg font-assistant text-neutral-600 text-center mb-6"
        >
          {isVoteParticipation
            ? 'כעת תוכלו להשלים את ההצבעה'
            : 'ההצבעה שלכם תפורסם בקרוב'}
        </Animated.Text>

        {/* Payment details */}
        <Animated.View
          entering={SlideInUp.delay(800)}
          className="bg-secondary-50 rounded-2xl p-5 w-full mb-8"
        >
          <View className="flex-row-reverse justify-between mb-3">
            <Text className="text-sm font-assistant text-secondary-600">סכום ששולם</Text>
            <Text className="text-lg font-heebo font-bold text-secondary-700">
              ₪{amount}
            </Text>
          </View>
          <View className="flex-row-reverse justify-between mb-3">
            <Text className="text-sm font-assistant text-secondary-600">טוקנים שהתקבלו</Text>
            <Text className="text-lg font-heebo font-bold text-secondary-700">
              {amount} SYNC
            </Text>
          </View>
          <View className="border-t border-secondary-200 pt-3">
            <View className="flex-row-reverse items-center">
              <Ionicons name="shield-checkmark" size={16} color="#10B981" />
              <Text className="text-xs font-assistant text-secondary-600 mr-1">
                מספר אישור: {params.paymentId?.slice(-8)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={SlideInUp.delay(1000)} className="w-full">
          <Pressable
            className="bg-primary-600 py-4 rounded-xl items-center active:bg-primary-700"
            onPress={handleContinue}
          >
            <Text className="text-white text-lg font-heebo font-semibold">
              {isVoteParticipation ? 'המשך להצבעה' : 'לדף הבית'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Token info */}
      <Animated.View
        entering={FadeIn.delay(1200)}
        className="px-5 pb-8"
      >
        <View className="bg-primary-50 rounded-xl p-4">
          <View className="flex-row-reverse items-center">
            <Ionicons name="information-circle" size={20} color="#2563EB" />
            <Text className="flex-1 text-sm font-assistant text-primary-700 text-right mr-2">
              הטוקנים שקיבלתם נוספו לחשבונכם וניתן להשתמש בהם להצבעות עתידיות
            </Text>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
