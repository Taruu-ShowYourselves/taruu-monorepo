import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';

export default function PaymentFailedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    error?: string;
    type?: string;
    voteId?: string;
  }>();

  const handleRetry = () => {
    router.replace({
      pathname: '/payment/checkout',
      params: {
        type: params.type || 'vote_participation',
        voteId: params.voteId || '',
      },
    });
  };

  const handleGoBack = () => {
    if (params.voteId) {
      router.replace(`/vote/${params.voteId}`);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        {/* Error icon */}
        <Animated.View
          entering={FadeIn.delay(200)}
          className="w-32 h-32 rounded-full bg-red-100 items-center justify-center mb-8"
        >
          <Ionicons name="close-circle" size={80} color="#DC2626" />
        </Animated.View>

        {/* Error message */}
        <Animated.Text
          entering={FadeIn.delay(400)}
          className="text-3xl font-heebo font-bold text-neutral-900 mb-3 text-center"
        >
          התשלום נכשל
        </Animated.Text>

        <Animated.Text
          entering={FadeIn.delay(600)}
          className="text-lg font-assistant text-neutral-600 text-center mb-6"
        >
          {params.error || 'אירעה שגיאה בעיבוד התשלום'}
        </Animated.Text>

        {/* Error details */}
        <Animated.View
          entering={SlideInUp.delay(800)}
          className="bg-red-50 rounded-2xl p-5 w-full mb-8"
        >
          <View className="flex-row-reverse items-start">
            <Ionicons name="alert-circle" size={24} color="#DC2626" />
            <View className="flex-1 mr-3">
              <Text className="text-base font-heebo font-semibold text-red-800 text-right mb-2">
                מה יכול לגרום לכשלון?
              </Text>
              <Text className="text-sm font-assistant text-red-700 text-right">
                • כרטיס האשראי נדחה{'\n'}
                • אין מספיק יתרה בחשבון{'\n'}
                • בעיית תקשורת זמנית{'\n'}
                • פרטי כרטיס לא נכונים
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={SlideInUp.delay(1000)} className="w-full">
          <Pressable
            className="bg-primary-600 py-4 rounded-xl items-center active:bg-primary-700 mb-3"
            onPress={handleRetry}
          >
            <Text className="text-white text-lg font-heebo font-semibold">
              נסו שוב
            </Text>
          </Pressable>

          <Pressable
            className="py-3 items-center"
            onPress={handleGoBack}
          >
            <Text className="text-neutral-500 font-heebo">חזרה</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Support info */}
      <Animated.View
        entering={FadeIn.delay(1200)}
        className="px-5 pb-8"
      >
        <View className="bg-neutral-50 rounded-xl p-4">
          <View className="flex-row-reverse items-center">
            <Ionicons name="help-circle" size={20} color="#6B7280" />
            <Text className="flex-1 text-sm font-assistant text-neutral-600 text-right mr-2">
              נתקלתם בבעיה? פנו לתמיכה: support@sync.co.il
            </Text>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
