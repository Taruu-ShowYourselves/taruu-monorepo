import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { usersApi, paymentsApi } from '@sync/api-client';
import { UserProfile, TokenBalance } from '@sync/shared';
import { formatCurrency } from '@sync/shared';

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View className="bg-white rounded-xl p-4 flex-1 border border-neutral-100">
      <Ionicons name={icon as any} size={24} color="#2563EB" />
      <Text className="text-2xl font-heebo font-bold text-neutral-900 mt-2">{value}</Text>
      <Text className="text-sm text-neutral-500 font-assistant">{label}</Text>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      className="flex-row-reverse items-center py-4 border-b border-neutral-100 active:bg-neutral-50"
      onPress={onPress}
    >
      <View className={`w-10 h-10 rounded-full items-center justify-center ${danger ? 'bg-red-100' : 'bg-primary-100'}`}>
        <Ionicons name={icon as any} size={20} color={danger ? '#EF4444' : '#2563EB'} />
      </View>
      <Text className={`flex-1 text-base font-heebo mr-3 ${danger ? 'text-red-600' : 'text-neutral-700'}`}>
        {label}
      </Text>
      <Ionicons name="chevron-back" size={20} color="#9CA3AF" />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tokens, setTokens] = useState<TokenBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileData, tokenData] = await Promise.all([
          usersApi.getProfile(),
          paymentsApi.getTokenBalance(),
        ]);
        setProfile(profileData);
        setTokens(tokenData);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSignOut = () => {
    Alert.alert(
      'התנתקות',
      'האם אתם בטוחים שברצונכם להתנתק?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'התנתק',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-primary-600 pt-6 pb-16 px-5">
          <Animated.View entering={FadeInDown.duration(400)}>
            <View className="flex-row-reverse items-center">
              <View className="w-16 h-16 rounded-full bg-white items-center justify-center">
                <Text className="text-2xl font-heebo font-bold text-primary-600">
                  {user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || '?'}
                </Text>
              </View>
              <View className="flex-1 mr-4">
                <Text className="text-xl font-heebo font-bold text-white text-right">
                  {user?.firstName || 'משתמש'} {user?.lastName || ''}
                </Text>
                <Text className="text-primary-200 font-assistant text-right">
                  {profile?.municipality || 'לא הוגדר'}
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Stats Cards */}
        <View className="px-5 -mt-10">
          <Animated.View entering={FadeInDown.duration(400).delay(100)} className="flex-row gap-3">
            <StatCard
              icon="checkmark-circle"
              label="הצבעות"
              value={profile?.totalVotes?.toString() || '0'}
            />
            <StatCard
              icon="star"
              label="טוקנים"
              value={tokens?.balance?.toString() || '0'}
            />
            <StatCard
              icon="create"
              label="יצרתם"
              value={profile?.votesCreated?.toString() || '0'}
            />
          </Animated.View>
        </View>

        {/* Token Balance Card */}
        <View className="px-5 mt-4">
          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <View className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-5">
              <View className="flex-row-reverse justify-between items-center">
                <View>
                  <Text className="text-primary-200 font-assistant text-right">יתרת טוקנים</Text>
                  <Text className="text-3xl font-heebo font-bold text-white text-right">
                    {tokens?.balance || 0}
                  </Text>
                </View>
                <View className="bg-white/20 rounded-full p-3">
                  <Ionicons name="wallet" size={28} color="white" />
                </View>
              </View>
              <Text className="text-primary-200 font-assistant text-right text-sm mt-3">
                כל הצבעה מזכה ב-1 טוקן. ניתן להמיר טוקנים להנחות והטבות.
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* Menu Items */}
        <View className="px-5 mt-6">
          <Animated.View entering={FadeInDown.duration(400).delay(300)}>
            <Text className="text-sm font-heebo text-neutral-500 text-right mb-2">
              הגדרות חשבון
            </Text>
            <View className="bg-white rounded-2xl px-4">
              <MenuItem
                icon="person"
                label="עריכת פרופיל"
                onPress={() => router.push('/settings/profile')}
              />
              <MenuItem
                icon="location"
                label="שינוי רשות"
                onPress={() => router.push('/settings/municipality')}
              />
              <MenuItem
                icon="notifications"
                label="התראות"
                onPress={() => router.push('/settings/notifications')}
              />
              <MenuItem
                icon="shield-checkmark"
                label="אימות זהות"
                onPress={() => router.push('/settings/verification')}
              />
            </View>
          </Animated.View>
        </View>

        <View className="px-5 mt-4">
          <Animated.View entering={FadeInDown.duration(400).delay(400)}>
            <Text className="text-sm font-heebo text-neutral-500 text-right mb-2">
              מידע
            </Text>
            <View className="bg-white rounded-2xl px-4">
              <MenuItem
                icon="document-text"
                label="תנאי שימוש"
                onPress={() => router.push('/legal/terms')}
              />
              <MenuItem
                icon="lock-closed"
                label="מדיניות פרטיות"
                onPress={() => router.push('/legal/privacy')}
              />
              <MenuItem
                icon="help-circle"
                label="עזרה ותמיכה"
                onPress={() => router.push('/support')}
              />
            </View>
          </Animated.View>
        </View>

        <View className="px-5 mt-4 mb-8">
          <Animated.View entering={FadeInDown.duration(400).delay(500)}>
            <View className="bg-white rounded-2xl px-4">
              <MenuItem icon="log-out" label="התנתקות" onPress={handleSignOut} danger />
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
