import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useUser } from '@/stores/authStore';
import { getAuthToken } from '@/lib/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://sync.co.il';

export default function EditProfileScreen() {
  const router = useRouter();
  const user = useUser();
  const updateUser = useAuthStore((state) => state.updateUser);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('שגיאה', 'אינך מחובר');
        return;
      }

      const response = await fetch(`${API_URL}/api/user/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName, lastName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      // Update local state
      updateUser({ firstName, lastName });

      Alert.alert('הצלחה', 'הפרופיל עודכן בהצלחה', [
        { text: 'אישור', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'לא ניתן לעדכן את הפרופיל';
      Alert.alert('שגיאה', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row-reverse items-center px-5 py-4 border-b border-neutral-100">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-forward" size={24} color="#374151" />
        </Pressable>
        <Text className="flex-1 text-lg font-heebo font-semibold text-neutral-900 text-right mr-4">
          עריכת פרופיל
        </Text>
      </View>

      <View className="px-5 pt-6">
        {/* Avatar */}
        <View className="items-center mb-6">
          <View className="w-24 h-24 rounded-full bg-primary-100 items-center justify-center">
            <Text className="text-3xl font-heebo font-bold text-primary-600">
              {firstName?.[0] || user?.email?.[0] || '?'}
            </Text>
          </View>
          <Pressable className="mt-3">
            <Text className="text-primary-600 font-heebo">שינוי תמונה</Text>
          </Pressable>
        </View>

        {/* Form */}
        <Text className="text-sm font-assistant text-neutral-600 text-right mb-1">שם פרטי</Text>
        <TextInput
          className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-right font-assistant mb-4"
          placeholder="הזינו שם פרטי"
          placeholderTextColor="#9CA3AF"
          value={firstName}
          onChangeText={setFirstName}
        />

        <Text className="text-sm font-assistant text-neutral-600 text-right mb-1">שם משפחה</Text>
        <TextInput
          className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-right font-assistant mb-4"
          placeholder="הזינו שם משפחה"
          placeholderTextColor="#9CA3AF"
          value={lastName}
          onChangeText={setLastName}
        />

        <Text className="text-sm font-assistant text-neutral-600 text-right mb-1">אימייל</Text>
        <View className="bg-neutral-100 border border-neutral-200 rounded-xl p-4 mb-6">
          <Text className="text-neutral-500 font-assistant text-right">
            {user?.email || ''}
          </Text>
        </View>

        <Pressable
          className={`py-4 rounded-xl items-center ${
            saving ? 'bg-neutral-300' : 'bg-primary-600 active:bg-primary-700'
          }`}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-lg font-heebo font-semibold">שמירה</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
