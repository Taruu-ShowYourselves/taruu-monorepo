import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function SignUpScreen() {
  const router = useRouter();
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const setError = useAuthStore((state) => state.setError);

  const handleGoogleSignUp = async () => {
    setError(null);
    const success = await signInWithGoogle(true);

    if (success) {
      // New users go to onboarding
      router.replace('/(auth)/onboarding');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-12">
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text className="text-3xl font-bold text-neutral-900 font-heebo mb-2">
            הצטרפו לתֵּרָאוּ
          </Text>
          <Text className="text-lg text-neutral-600 font-assistant mb-8">
            יצרו חשבון והתחילו להצביע על נושאים מקומיים
          </Text>
        </Animated.View>

        {/* Error */}
        {error ? (
          <Animated.View entering={FadeInDown.duration(200)}>
            <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <Text className="text-red-600 text-center font-assistant">
                {error}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Google Sign Up */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          className="gap-4"
        >
          <Pressable
            className="bg-white border-2 border-neutral-200 py-4 rounded-xl items-center flex-row justify-center gap-3 active:border-primary-500"
            onPress={handleGoogleSignUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#2563EB" />
            ) : (
              <>
                <GoogleIcon />
                <Text className="text-neutral-700 font-heebo font-medium text-lg">
                  הרשמה עם Google
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>

        {/* Features */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(300)}
          className="mt-8 gap-4"
        >
          <View className="flex-row items-start gap-4 bg-neutral-50 p-4 rounded-xl">
            <Text className="text-2xl">🗳️</Text>
            <View className="flex-1">
              <Text className="font-heebo font-semibold text-neutral-900">
                הצביעו על נושאים מקומיים
              </Text>
              <Text className="font-assistant text-neutral-600 text-sm">
                השפיעו על ההחלטות בקהילה שלכם
              </Text>
            </View>
          </View>

          <View className="flex-row items-start gap-4 bg-neutral-50 p-4 rounded-xl">
            <Text className="text-2xl">🔒</Text>
            <View className="flex-1">
              <Text className="font-heebo font-semibold text-neutral-900">
                הצבעות מאובטחות
              </Text>
              <Text className="font-assistant text-neutral-600 text-sm">
                כל הצבעה נרשמת בבלוקצ׳יין
              </Text>
            </View>
          </View>

          <View className="flex-row items-start gap-4 bg-neutral-50 p-4 rounded-xl">
            <Text className="text-2xl">🪙</Text>
            <View className="flex-1">
              <Text className="font-heebo font-semibold text-neutral-900">
                צברו טוקנים SYNC
              </Text>
              <Text className="font-assistant text-neutral-600 text-sm">
                כל הצבעה מזכה ב-3 טוקנים
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Divider */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(500)}
          className="flex-row items-center my-8"
        >
          <View className="flex-1 h-px bg-neutral-200" />
          <Text className="mx-4 text-neutral-500 font-assistant">
            יש לכם חשבון?
          </Text>
          <View className="flex-1 h-px bg-neutral-200" />
        </Animated.View>

        {/* Sign In Link */}
        <Animated.View entering={FadeInDown.duration(400).delay(600)}>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable className="border-2 border-primary-600 py-4 rounded-xl items-center">
              <Text className="text-primary-600 text-lg font-heebo font-semibold">
                התחברות לחשבון קיים
              </Text>
            </Pressable>
          </Link>
        </Animated.View>

        {/* Terms */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(700)}
          className="mt-6"
        >
          <Text className="text-center text-sm text-neutral-500 font-assistant">
            בהרשמה אתם מסכימים לתנאי השימוש ומדיניות הפרטיות שלנו
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

// Google icon component
function GoogleIcon() {
  return (
    <View className="w-5 h-5">
      {/* Simple G icon - in production use proper SVG */}
      <Text className="text-xl font-bold text-blue-500">G</Text>
    </View>
  );
}
