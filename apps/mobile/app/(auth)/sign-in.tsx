import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSignIn } from '@clerk/clerk-expo';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    if (!isLoaded) return;

    setLoading(true);
    setError('');

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
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

        {/* Form */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          className="gap-4"
        >
          {/* Email */}
          <View>
            <Text className="text-sm font-medium text-neutral-700 mb-2 font-assistant">
              אימייל
            </Text>
            <TextInput
              className="border border-neutral-300 rounded-xl px-4 py-3 text-right font-assistant"
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password */}
          <View>
            <Text className="text-sm font-medium text-neutral-700 mb-2 font-assistant">
              סיסמה
            </Text>
            <TextInput
              className="border border-neutral-300 rounded-xl px-4 py-3 text-right font-assistant"
              placeholder="הסיסמה שלך"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Error */}
          {error ? (
            <Text className="text-red-500 text-center font-assistant">
              {error}
            </Text>
          ) : null}

          {/* Sign In Button */}
          <Pressable
            className="bg-primary-600 py-4 rounded-xl items-center mt-4 active:bg-primary-700"
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-lg font-heebo font-semibold">
                התחברות
              </Text>
            )}
          </Pressable>
        </Animated.View>

        {/* Divider */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(400)}
          className="flex-row items-center my-6"
        >
          <View className="flex-1 h-px bg-neutral-200" />
          <Text className="mx-4 text-neutral-500 font-assistant">או</Text>
          <View className="flex-1 h-px bg-neutral-200" />
        </Animated.View>

        {/* Social Login */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(500)}
          className="gap-3"
        >
          <Pressable className="border border-neutral-300 py-4 rounded-xl items-center flex-row justify-center gap-3">
            <Text className="text-neutral-700 font-heebo font-medium">
              המשך עם Google
            </Text>
          </Pressable>

          <Pressable className="border border-neutral-300 py-4 rounded-xl items-center flex-row justify-center gap-3">
            <Text className="text-neutral-700 font-heebo font-medium">
              המשך עם Apple
            </Text>
          </Pressable>
        </Animated.View>

        {/* Sign Up Link */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(600)}
          className="flex-row justify-center mt-8"
        >
          <Text className="text-neutral-600 font-assistant">
            אין לך חשבון?{' '}
          </Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable>
              <Text className="text-primary-600 font-semibold font-assistant">
                הירשמו עכשיו
              </Text>
            </Pressable>
          </Link>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
