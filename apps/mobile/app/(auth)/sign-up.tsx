import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSignUp } from '@clerk/clerk-expo';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');

  const handleSignUp = async () => {
    if (!isLoaded) return;

    setLoading(true);
    setError('');

    try {
      await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'שגיאה בהרשמה');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async () => {
    if (!isLoaded) return;

    setLoading(true);
    setError('');

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(auth)/onboarding');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'קוד לא תקין');
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 px-6 pt-12">
          <Animated.View entering={FadeInDown.duration(400)}>
            <Text className="text-3xl font-bold text-neutral-900 font-heebo mb-2">
              אימות אימייל
            </Text>
            <Text className="text-lg text-neutral-600 font-assistant mb-8">
              שלחנו קוד אימות ל-{email}
            </Text>
          </Animated.View>

          <View className="gap-4">
            <View>
              <Text className="text-sm font-medium text-neutral-700 mb-2 font-assistant">
                קוד אימות
              </Text>
              <TextInput
                className="border border-neutral-300 rounded-xl px-4 py-3 text-center text-2xl font-heebo tracking-widest"
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
              />
            </View>

            {error ? (
              <Text className="text-red-500 text-center font-assistant">
                {error}
              </Text>
            ) : null}

            <Pressable
              className="bg-primary-600 py-4 rounded-xl items-center mt-4 active:bg-primary-700"
              onPress={handleVerification}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-lg font-heebo font-semibold">
                  אימות
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-12">
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text className="text-3xl font-bold text-neutral-900 font-heebo mb-2">
            יצירת חשבון
          </Text>
          <Text className="text-lg text-neutral-600 font-assistant mb-8">
            הצטרפו למשפחת סינק
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          className="gap-4"
        >
          {/* Name Row */}
          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-sm font-medium text-neutral-700 mb-2 font-assistant">
                שם פרטי
              </Text>
              <TextInput
                className="border border-neutral-300 rounded-xl px-4 py-3 text-right font-assistant"
                placeholder="ישראל"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-neutral-700 mb-2 font-assistant">
                שם משפחה
              </Text>
              <TextInput
                className="border border-neutral-300 rounded-xl px-4 py-3 text-right font-assistant"
                placeholder="ישראלי"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

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
              placeholder="לפחות 8 תווים"
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

          {/* Sign Up Button */}
          <Pressable
            className="bg-primary-600 py-4 rounded-xl items-center mt-4 active:bg-primary-700"
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-lg font-heebo font-semibold">
                הרשמה
              </Text>
            )}
          </Pressable>
        </Animated.View>

        {/* Sign In Link */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(400)}
          className="flex-row justify-center mt-8"
        >
          <Text className="text-neutral-600 font-assistant">
            כבר יש לך חשבון?{' '}
          </Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable>
              <Text className="text-primary-600 font-semibold font-assistant">
                התחברו
              </Text>
            </Pressable>
          </Link>
        </Animated.View>

        {/* Terms */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(500)}
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
