import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useUser, useIdentityScore } from '@/stores/authStore';
import {
  connectFacebook,
  connectInstagram,
  disconnectSocialPlatform,
  getSocialProofs,
} from '@/lib/auth';
import { getIdentityLevelLabel, getIdentityLevelDescription } from '@sync/shared';
import type { SocialProof, IdentityScore } from '@sync/shared';

export default function SocialConnectionsScreen() {
  const router = useRouter();
  const user = useUser();
  const identityScore = useIdentityScore();
  const updateUser = useAuthStore((state) => state.updateUser);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [socialProofs, setSocialProofs] = useState<SocialProof[]>([]);
  const [currentScore, setCurrentScore] = useState<IdentityScore | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getSocialProofs();
      if (result.success) {
        // Transform API response to match SocialProof type (connectedAt string -> Date)
        const transformedProofs: SocialProof[] = (result.socialProofs || []).map((proof) => ({
          ...proof,
          connectedAt: new Date(proof.connectedAt),
        }));
        setSocialProofs(transformedProofs);
        if (result.identityScore) {
          setCurrentScore(result.identityScore as IdentityScore);
          updateUser({ identityScore: result.identityScore as IdentityScore });
        }
      }
    } catch (_error) {
      console.error('Error fetching social proofs:', _error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [updateUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleConnectFacebook = async () => {
    if (!user?.id) return;
    setConnecting('facebook');
    try {
      const result = await connectFacebook(user.id);
      if (result.success) {
        Alert.alert('הצלחה', 'פייסבוק חובר בהצלחה!');
        fetchData();
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
        Alert.alert('הצלחה', 'אינסטגרם חובר בהצלחה!');
        fetchData();
      } else {
        Alert.alert('שגיאה', result.error || 'לא ניתן לחבר את אינסטגרם');
      }
    } catch (_error) {
      Alert.alert('שגיאה', 'לא ניתן לחבר את אינסטגרם');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (platform: 'facebook' | 'instagram') => {
    const platformName = platform === 'facebook' ? 'פייסבוק' : 'אינסטגרם';

    Alert.alert(
      `ניתוק ${platformName}`,
      `האם אתה בטוח שברצונך לנתק את ${platformName}? הציון שלך יירד.`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'נתק',
          style: 'destructive',
          onPress: async () => {
            setDisconnecting(platform);
            try {
              const result = await disconnectSocialPlatform(platform);
              if (result.success) {
                Alert.alert('הצלחה', `${platformName} נותק בהצלחה`);
                fetchData();
              } else {
                Alert.alert('שגיאה', result.error || 'לא ניתן לנתק');
              }
            } catch (_error) {
              Alert.alert('שגיאה', 'לא ניתן לנתק');
            } finally {
              setDisconnecting(null);
            }
          },
        },
      ]
    );
  };

  const score = currentScore || identityScore;
  const googleProof = socialProofs.find((p) => p.platform === 'google');
  const facebookProof = socialProofs.find((p) => p.platform === 'facebook');
  const instagramProof = socialProofs.find((p) => p.platform === 'instagram');

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'trusted':
        return 'bg-primary-100 text-primary-700';
      case 'verified':
        return 'bg-secondary-100 text-secondary-700';
      default:
        return 'bg-neutral-100 text-neutral-600';
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-3 text-neutral-500 font-assistant">טוען...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row-reverse items-center px-5 py-4 bg-white border-b border-neutral-100">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-forward" size={24} color="#374151" />
        </Pressable>
        <Text className="flex-1 text-lg font-heebo font-semibold text-neutral-900 text-right mr-4">
          חיבור רשתות חברתיות
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Description */}
        <Text className="text-sm font-assistant text-neutral-500 text-right mb-5">
          חברו את הרשתות החברתיות שלכם כדי להגדיל את ציון הזהות ולקבל גישה מלאה
          לפלטפורמה
        </Text>

        {/* Identity Score Card */}
        <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
          <View className="flex-row-reverse justify-between items-center mb-3">
            <Text className="text-lg font-heebo font-semibold text-neutral-900">
              ציון זהות
            </Text>
            <View
              className={`px-3 py-1 rounded-full ${getLevelColor(score?.level || 'basic')}`}
            >
              <Text className="font-heebo font-semibold text-sm">
                {getIdentityLevelLabel(score?.level || 'basic')}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View className="flex-row-reverse items-center mb-2">
            <View className="flex-1 h-3 bg-neutral-200 rounded-full overflow-hidden ml-3">
              <View
                className="h-full bg-gradient-to-l from-primary-500 to-secondary-500 rounded-full"
                style={{ width: `${score?.total || 0}%` }}
              />
            </View>
            <Text className="font-heebo font-bold text-neutral-900">
              {score?.total || 0}/100
            </Text>
          </View>

          <Text className="text-sm font-assistant text-neutral-500 text-right mb-4">
            {getIdentityLevelDescription(score?.level || 'basic')}
          </Text>

          {/* Breakdown */}
          <View className="border-t border-neutral-100 pt-3">
            <View className="flex-row-reverse justify-between py-1">
              <Text className="text-sm font-assistant text-neutral-500">Google</Text>
              <Text className="text-sm font-heebo text-neutral-900">
                {score?.breakdown?.google || 0} נקודות
              </Text>
            </View>
            <View className="flex-row-reverse justify-between py-1">
              <Text className="text-sm font-assistant text-neutral-500">Facebook</Text>
              <Text className="text-sm font-heebo text-neutral-900">
                {score?.breakdown?.facebook || 0} נקודות
              </Text>
            </View>
            <View className="flex-row-reverse justify-between py-1">
              <Text className="text-sm font-assistant text-neutral-500">Instagram</Text>
              <Text className="text-sm font-heebo text-neutral-900">
                {score?.breakdown?.instagram || 0} נקודות
              </Text>
            </View>
          </View>
        </View>

        {/* Connections */}
        <Text className="text-lg font-heebo font-semibold text-neutral-900 text-right mb-3">
          חשבונות מחוברים
        </Text>

        {/* Google - Always connected */}
        <View className="bg-white rounded-2xl p-4 mb-3 border-2 border-secondary-200">
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
                  {googleProof?.email || user?.email}
                </Text>
              </View>
            </View>
            <View className="items-start">
              <View className="bg-secondary-100 px-2 py-1 rounded-md mb-1">
                <Text className="text-xs font-heebo text-secondary-700">מחובר</Text>
              </View>
              <Text className="text-sm font-heebo text-primary-600">+40 נקודות</Text>
            </View>
          </View>
        </View>

        {/* Facebook */}
        <View
          className={`bg-white rounded-2xl p-4 mb-3 ${
            facebookProof ? 'border-2 border-secondary-200' : ''
          }`}
        >
          <View className="flex-row-reverse items-center justify-between">
            <View className="flex-row-reverse items-center flex-1">
              <View
                className={`w-12 h-12 rounded-xl items-center justify-center mr-3 ${
                  facebookProof ? 'bg-secondary-100' : 'bg-neutral-100'
                }`}
              >
                <Text
                  className={`text-xl font-bold ${
                    facebookProof ? 'text-secondary-600' : 'text-neutral-500'
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
                  {facebookProof
                    ? facebookProof.displayName || facebookProof.email
                    : 'חברו את Facebook להוספת 30 נקודות'}
                </Text>
              </View>
            </View>
            <View className="items-start">
              {facebookProof ? (
                <>
                  <View className="bg-secondary-100 px-2 py-1 rounded-md mb-1">
                    <Text className="text-xs font-heebo text-secondary-700">מחובר</Text>
                  </View>
                  <Text className="text-sm font-heebo text-primary-600 mb-2">
                    +30 נקודות
                  </Text>
                  <Pressable
                    onPress={() => handleDisconnect('facebook')}
                    disabled={disconnecting === 'facebook'}
                    className="py-1"
                  >
                    {disconnecting === 'facebook' ? (
                      <ActivityIndicator size="small" color="#6B7280" />
                    ) : (
                      <Text className="text-sm font-heebo text-neutral-500">נתק</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={handleConnectFacebook}
                  disabled={connecting === 'facebook'}
                  className="bg-primary-600 px-4 py-2 rounded-xl active:bg-primary-700"
                >
                  {connecting === 'facebook' ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white font-heebo font-semibold">חבר</Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* Instagram */}
        <View
          className={`bg-white rounded-2xl p-4 mb-5 ${
            instagramProof ? 'border-2 border-secondary-200' : ''
          }`}
        >
          <View className="flex-row-reverse items-center justify-between">
            <View className="flex-row-reverse items-center flex-1">
              <View
                className={`w-12 h-12 rounded-xl items-center justify-center mr-3 ${
                  instagramProof ? 'bg-secondary-100' : 'bg-neutral-100'
                }`}
              >
                <Ionicons
                  name="camera"
                  size={24}
                  color={instagramProof ? '#059669' : '#6B7280'}
                />
              </View>
              <View className="flex-1">
                <Text className="font-heebo font-semibold text-neutral-900 text-right">
                  Instagram
                </Text>
                <Text className="text-sm font-assistant text-neutral-500 text-right">
                  {instagramProof
                    ? `@${instagramProof.displayName}`
                    : 'חברו את Instagram להוספת 30 נקודות'}
                </Text>
              </View>
            </View>
            <View className="items-start">
              {instagramProof ? (
                <>
                  <View className="bg-secondary-100 px-2 py-1 rounded-md mb-1">
                    <Text className="text-xs font-heebo text-secondary-700">מחובר</Text>
                  </View>
                  <Text className="text-sm font-heebo text-primary-600 mb-2">
                    +30 נקודות
                  </Text>
                  <Pressable
                    onPress={() => handleDisconnect('instagram')}
                    disabled={disconnecting === 'instagram'}
                    className="py-1"
                  >
                    {disconnecting === 'instagram' ? (
                      <ActivityIndicator size="small" color="#6B7280" />
                    ) : (
                      <Text className="text-sm font-heebo text-neutral-500">נתק</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={handleConnectInstagram}
                  disabled={connecting === 'instagram'}
                  className="bg-primary-600 px-4 py-2 rounded-xl active:bg-primary-700"
                >
                  {connecting === 'instagram' ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white font-heebo font-semibold">חבר</Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* Info Section */}
        <View className="bg-neutral-100 rounded-2xl p-5 mb-5">
          <Text className="text-base font-heebo font-semibold text-neutral-900 text-right mb-3">
            למה לחבר רשתות חברתיות?
          </Text>

          <View className="mb-2">
            <View className="flex-row-reverse items-start">
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text className="flex-1 text-sm font-assistant text-neutral-600 text-right mr-2">
                <Text className="font-semibold text-neutral-900">אימות זהות:</Text> כל
                חשבון מחובר מוסיף שכבת אימות נוספת
              </Text>
            </View>
          </View>

          <View className="mb-2">
            <View className="flex-row-reverse items-start">
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text className="flex-1 text-sm font-assistant text-neutral-600 text-right mr-2">
                <Text className="font-semibold text-neutral-900">ציון גבוה יותר:</Text>{' '}
                ציון זהות גבוה מאפשר השתתפות בהצבעות חשובות
              </Text>
            </View>
          </View>

          <View className="mb-3">
            <View className="flex-row-reverse items-start">
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text className="flex-1 text-sm font-assistant text-neutral-600 text-right mr-2">
                <Text className="font-semibold text-neutral-900">אמינות:</Text> משתמשים
                עם ציון גבוה נחשבים אמינים יותר בקהילה
              </Text>
            </View>
          </View>

          <View className="border-t border-neutral-200 pt-3">
            <Text className="text-xs font-assistant text-neutral-500 text-right">
              אנחנו לא מפרסמים בשמכם או משתפים את המידע שלכם. החיבור משמש לאימות
              זהות בלבד.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
