import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

export default function WelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center items-center px-6">
        {/* Logo */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(200)}
          className="mb-8"
        >
          <Text className="text-6xl font-bold text-primary-600 font-heebo">
            סינק
          </Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(400)}
          className="mb-12"
        >
          <Text className="text-2xl text-center text-neutral-800 font-heebo font-bold mb-2">
            הקול שלך. הקהילה שלך.
          </Text>
          <Text className="text-2xl text-center text-primary-600 font-heebo font-bold">
            העתיד שלנו.
          </Text>
        </Animated.View>

        {/* Description */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(600)}
          className="mb-12"
        >
          <Text className="text-lg text-center text-neutral-600 font-assistant leading-7">
            הצטרפו לאלפי אזרחים שמשפיעים על ההחלטות המקומיות בקהילה שלהם.
            הצביעו, עקבו, ותהיו חלק מהשינוי.
          </Text>
        </Animated.View>

        {/* Buttons */}
        <Animated.View
          entering={FadeInUp.duration(600).delay(800)}
          className="w-full gap-4"
        >
          <Link href="/(auth)/sign-up" asChild>
            <Pressable className="bg-primary-600 py-4 rounded-xl items-center active:bg-primary-700">
              <Text className="text-white text-lg font-heebo font-semibold">
                הרשמה
              </Text>
            </Pressable>
          </Link>

          <Link href="/(auth)/sign-in" asChild>
            <Pressable className="border-2 border-primary-600 py-4 rounded-xl items-center active:bg-primary-50">
              <Text className="text-primary-600 text-lg font-heebo font-semibold">
                התחברות
              </Text>
            </Pressable>
          </Link>
        </Animated.View>

        {/* Trust indicators */}
        <Animated.View
          entering={FadeInUp.duration(600).delay(1000)}
          className="flex-row justify-center gap-6 mt-12"
        >
          <View className="items-center">
            <Text className="text-lg font-bold text-neutral-800">100%</Text>
            <Text className="text-sm text-neutral-500">שקיפות</Text>
          </View>
          <View className="w-px h-10 bg-neutral-200" />
          <View className="items-center">
            <Text className="text-lg font-bold text-neutral-800">₪3</Text>
            <Text className="text-sm text-neutral-500">להצבעה</Text>
          </View>
          <View className="w-px h-10 bg-neutral-200" />
          <View className="items-center">
            <Text className="text-lg font-bold text-neutral-800">GPS</Text>
            <Text className="text-sm text-neutral-500">מאומת</Text>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
