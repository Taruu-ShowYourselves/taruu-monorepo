import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function SignInScreen() {
  const router = useRouter();
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const setError = useAuthStore((state) => state.setError);

  const handleGoogleSignIn = async () => {
    setError(null);
    const success = await signInWithGoogle(false);

    if (success) {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-12">
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text className="text-3xl font-bold text-neutral-900 font-heebo mb-2">
            התחברות
          </Text>
          <Text className="text-lg text-neutral-600 font-assistant mb-8">
            ברוכים השבים! התחברו כדי להמשיך
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

        {/* Google Sign In */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          className="gap-4"
        >
          <Pressable
            className="bg-white border-2 border-neutral-200 py-4 rounded-xl items-center flex-row justify-center gap-3 active:border-primary-500"
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#2563EB" />
            ) : (
              <>
                <GoogleIcon />
                <Text className="text-neutral-700 font-heebo font-medium text-lg">
                  התחבר עם Google
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>

        {/* Features */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(400)}
          className="flex-row justify-center gap-6 mt-8 flex-wrap"
        >
          <View className="flex-row items-center gap-2">
            <Text className="text-lg">🔒</Text>
            <Text className="text-neutral-600 font-assistant text-sm">
              מאובטח בבלוקצ׳יין
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-lg">📍</Text>
            <Text className="text-neutral-600 font-assistant text-sm">
              אימות מיקום
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-lg">🎫</Text>
            <Text className="text-neutral-600 font-assistant text-sm">
              טוקנים לתרומה
            </Text>
          </View>
        </Animated.View>

        {/* Divider */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(500)}
          className="flex-row items-center my-8"
        >
          <View className="flex-1 h-px bg-neutral-200" />
          <Text className="mx-4 text-neutral-500 font-assistant">
            אין לך חשבון?
          </Text>
          <View className="flex-1 h-px bg-neutral-200" />
        </Animated.View>

        {/* Sign Up Link */}
        <Animated.View entering={FadeInDown.duration(400).delay(600)}>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable className="border-2 border-primary-600 py-4 rounded-xl items-center">
              <Text className="text-primary-600 text-lg font-heebo font-semibold">
                הירשמו עכשיו
              </Text>
            </Pressable>
          </Link>
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
