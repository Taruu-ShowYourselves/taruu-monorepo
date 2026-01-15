import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useUser } from '@/stores/authStore';
import { connectFacebook, connectInstagram } from '@/lib/auth';
import { getIdentityLevelLabel, type IdentityScore } from '@sync/shared';

export default function ConnectSocialScreen() {
  const router = useRouter();
  const user = useUser();
  const updateUser = useAuthStore((state) => state.updateUser);

  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  const handleConnectFacebook = async () => {
    if (!user?.id) return;
    setConnecting('facebook');
    try {
      const result = await connectFacebook(user.id);
      if (result.success) {
        setConnectedPlatforms([...connectedPlatforms, 'facebook']);
        // Update user identity score
        const newTotal = (user.identityScore?.total || 40) + 30;
        const newScore: IdentityScore = {
          total: newTotal,
          level: newTotal >= 100 ? 'trusted' : 'verified',
          breakdown: {
            google: user.identityScore?.breakdown?.google || 40,
            facebook: 30,
            instagram: user.identityScore?.breakdown?.instagram || 0,
          },
        };
        updateUser({ identityScore: newScore });
      } else {
        Alert.alert('שגיאה', result.error || 'לא ניתן לחבר את פייסבוק');
      }
    } catch (_error) {
      Alert.alert('שגיאה', 'לא ניתן לחבר את פייסבוק');
    } finally {
      setConnecting(null);
    }
  };

  const handleConnectInstagram = async () => {
    if (!user?.id) return;
    setConnecting('instagram');
    try {
      const result = await connectInstagram(user.id);
      if (result.success) {
        setConnectedPlatforms([...connectedPlatforms, 'instagram']);
        // Update user identity score
        const newTotal = (user.identityScore?.total || 40) + 30;
        const newScore: IdentityScore = {
          total: newTotal,
          level: newTotal >= 100 ? 'trusted' : 'verified',
          breakdown: {
            google: user.identityScore?.breakdown?.google || 40,
            facebook: user.identityScore?.breakdown?.facebook || 0,
            instagram: 30,
          },
        };
        updateUser({ identityScore: newScore });
      } else {
        Alert.alert('שגיאה', result.error || 'לא ניתן לחבר את אינסטגרם');
      }
    } catch (_error) {
      Alert.alert('שגיאה', 'לא ניתן לחבר את אינסטגרם');
    } finally {
      setConnecting(null);
    }
  };

  const handleSkip = () => {
    // Continue to main app
    router.replace('/(tabs)');
  };

  const handleContinue = () => {
    router.replace('/(tabs)');
  };

  const currentScore = user?.identityScore?.total || 40;
  const currentLevel = getIdentityLevelLabel(user?.identityScore?.level || 'basic');
  const facebookConnected = connectedPlatforms.includes('facebook');
  const instagramConnected = connectedPlatforms.includes('instagram');

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6">
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          className="mt-8 mb-6"
        >
          <Text className="text-3xl font-heebo font-bold text-neutral-900 text-right mb-2">
            שפרו את ציון הזהות
          </Text>
          <Text className="text-base font-assistant text-neutral-500 text-right">
            חברו עוד רשתות חברתיות לאימות זהות מלא ולגישה לכל ההצבעות
          </Text>
        </Animated.View>

        {/* Current Score */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(100)}
          className="bg-primary-50 rounded-2xl p-5 mb-6"
        >
          <View className="flex-row-reverse justify-between items-center mb-3">
            <Text className="text-lg font-heebo font-semibold text-neutral-900">
              הציון הנוכחי שלכם
            </Text>
            <View className="bg-primary-600 px-3 py-1 rounded-full">
              <Text className="text-white font-heebo font-semibold">
                {currentScore}/100
              </Text>
            </View>
          </View>
          <View className="h-3 bg-neutral-200 rounded-full overflow-hidden mb-2">
            <View
              className="h-full bg-primary-600 rounded-full"
              style={{ width: `${currentScore}%` }}
            />
          </View>
          <Text className="text-sm font-assistant text-neutral-600 text-right">
            רמה: {currentLevel}
          </Text>
        </Animated.View>

        {/* Google - Already Connected */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(200)}
          className="bg-secondary-50 rounded-2xl p-4 mb-3 border-2 border-secondary-200"
        >
          <View className="flex-row-reverse items-center justify-between">
            <View className="flex-row-reverse items-center flex-1">
              <View className="w-12 h-12 rounded-xl bg-secondary-100 items-center justify-center mr-3">
                <Text className="text-xl font-bold text-secondary-600">G</Text>
              </View>
              <View className="flex-1">
                <Text className="font-heebo font-semibold text-neutral-900 text-right">
                  Google
                </Text>
                <Text className="text-sm font-assistant text-neutral-500 text-right">
                  מחובר
                </Text>
              </View>
            </View>
            <View className="items-start">
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text className="text-sm font-heebo text-secondary-600 mt-1">
                +40 נקודות
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Facebook */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(300)}
          className={`rounded-2xl p-4 mb-3 ${
            facebookConnected
              ? 'bg-secondary-50 border-2 border-secondary-200'
              : 'bg-white border border-neutral-200'
          }`}
        >
          <View className="flex-row-reverse items-center justify-between">
            <View className="flex-row-reverse items-center flex-1">
              <View
                className={`w-12 h-12 rounded-xl items-center justify-center mr-3 ${
                  facebookConnected ? 'bg-secondary-100' : 'bg-neutral-100'
                }`}
              >
                <Text
                  className={`text-xl font-bold ${
                    facebookConnected ? 'text-secondary-600' : 'text-[#1877F2]'
                  }`}
                >
                  f
                </Text>
              </View>
              <View className="flex-1">
                <Text className="font-heebo font-semibold text-neutral-900 text-right">
                  Facebook
                </Text>
                <Text className="text-sm font-assistant text-neutral-500 text-right">
                  {facebookConnected ? 'מחובר' : 'הוסיפו 30 נקודות לציון'}
                </Text>
              </View>
            </View>
            <View className="items-start">
              {facebookConnected ? (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <Text className="text-sm font-heebo text-secondary-600 mt-1">
                    +30 נקודות
                  </Text>
                </>
              ) : (
                <Pressable
                  onPress={handleConnectFacebook}
                  disabled={connecting === 'facebook'}
                  className="bg-[#1877F2] px-4 py-2 rounded-xl active:bg-[#1565C0]"
                >
                  {connecting === 'facebook' ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white font-heebo font-semibold">
                      חבר
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Instagram */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(400)}
          className={`rounded-2xl p-4 mb-6 ${
            instagramConnected
              ? 'bg-secondary-50 border-2 border-secondary-200'
              : 'bg-white border border-neutral-200'
          }`}
        >
          <View className="flex-row-reverse items-center justify-between">
            <View className="flex-row-reverse items-center flex-1">
              <View
                className={`w-12 h-12 rounded-xl items-center justify-center mr-3 ${
                  instagramConnected ? 'bg-secondary-100' : 'bg-gradient-to-tr'
                }`}
                style={
                  !instagramConnected
                    ? {
                        backgroundColor: '#E1306C',
                      }
                    : {}
                }
              >
                <Ionicons
                  name="camera"
                  size={24}
                  color={instagramConnected ? '#059669' : 'white'}
                />
              </View>
              <View className="flex-1">
                <Text className="font-heebo font-semibold text-neutral-900 text-right">
                  Instagram
                </Text>
                <Text className="text-sm font-assistant text-neutral-500 text-right">
                  {instagramConnected ? 'מחובר' : 'הוסיפו 30 נקודות לציון'}
                </Text>
              </View>
            </View>
            <View className="items-start">
              {instagramConnected ? (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <Text className="text-sm font-heebo text-secondary-600 mt-1">
                    +30 נקודות
                  </Text>
                </>
              ) : (
                <Pressable
                  onPress={handleConnectInstagram}
                  disabled={connecting === 'instagram'}
                  className="bg-[#E1306C] px-4 py-2 rounded-xl active:bg-[#C13584]"
                >
                  {connecting === 'instagram' ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white font-heebo font-semibold">
                      חבר
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Info */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(500)}
          className="flex-row-reverse items-start mb-6"
        >
          <Ionicons name="shield-checkmark" size={20} color="#10B981" />
          <Text className="flex-1 text-sm font-assistant text-neutral-500 text-right mr-2">
            אנחנו לא מפרסמים בשמכם ולא משתפים מידע. החיבור משמש לאימות זהות בלבד.
          </Text>
        </Animated.View>
      </View>

      {/* Bottom Actions */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(600)}
        className="px-6 pb-6"
      >
        <Pressable
          onPress={handleContinue}
          className="bg-primary-600 py-4 rounded-2xl items-center mb-3 active:bg-primary-700"
        >
          <Text className="text-white text-lg font-heebo font-semibold">
            {connectedPlatforms.length > 0 ? 'המשך לאפליקציה' : 'המשך בלי לחבר'}
          </Text>
        </Pressable>

        {connectedPlatforms.length === 0 && (
          <Pressable onPress={handleSkip} className="py-2 items-center">
            <Text className="text-neutral-500 font-assistant">
              אפשר לחבר גם אחר כך בהגדרות
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}
