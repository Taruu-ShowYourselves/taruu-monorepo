import { useState, useEffect } from 'react';
import { View, Text, Switch, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usersApi } from '@sync/api-client';

interface NotificationSettings {
  newVotes: boolean;
  voteEnding: boolean;
  voteResults: boolean;
  marketing: boolean;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSettings>({
    newVotes: true,
    voteEnding: true,
    voteResults: true,
    marketing: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const profile = await usersApi.getProfile();
        if (profile.notificationSettings) {
          setSettings(profile.notificationSettings);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleToggle = (key: keyof NotificationSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await usersApi.updateProfile({ notificationSettings: settings });
      Alert.alert('הצלחה', 'ההגדרות נשמרו בהצלחה', [
        { text: 'אישור', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('שגיאה', err.message || 'לא ניתן לשמור את ההגדרות');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
          הגדרות התראות
        </Text>
      </View>

      <View className="flex-1 px-5 pt-6">
        <Text className="text-sm font-heebo text-neutral-500 text-right mb-2">התראות הצבעות</Text>
        <View className="bg-neutral-50 rounded-2xl px-4">
          <View className="flex-row-reverse items-center justify-between py-4 border-b border-neutral-200">
            <View className="flex-1 mr-3">
              <Text className="text-base font-heebo text-neutral-700 text-right">הצבעות חדשות</Text>
              <Text className="text-sm text-neutral-500 font-assistant text-right">
                קבלו התראה כשנוצרת הצבעה חדשה ברשות שלכם
              </Text>
            </View>
            <Switch
              value={settings.newVotes}
              onValueChange={() => handleToggle('newVotes')}
              trackColor={{ true: '#2563EB', false: '#D1D5DB' }}
              thumbColor="white"
            />
          </View>

          <View className="flex-row-reverse items-center justify-between py-4 border-b border-neutral-200">
            <View className="flex-1 mr-3">
              <Text className="text-base font-heebo text-neutral-700 text-right">
                סיום הצבעה מתקרב
              </Text>
              <Text className="text-sm text-neutral-500 font-assistant text-right">
                תזכורת יום לפני סיום הצבעה
              </Text>
            </View>
            <Switch
              value={settings.voteEnding}
              onValueChange={() => handleToggle('voteEnding')}
              trackColor={{ true: '#2563EB', false: '#D1D5DB' }}
              thumbColor="white"
            />
          </View>

          <View className="flex-row-reverse items-center justify-between py-4">
            <View className="flex-1 mr-3">
              <Text className="text-base font-heebo text-neutral-700 text-right">תוצאות הצבעה</Text>
              <Text className="text-sm text-neutral-500 font-assistant text-right">
                קבלו התראה כשמתפרסמות תוצאות הצבעה שהשתתפתם בה
              </Text>
            </View>
            <Switch
              value={settings.voteResults}
              onValueChange={() => handleToggle('voteResults')}
              trackColor={{ true: '#2563EB', false: '#D1D5DB' }}
              thumbColor="white"
            />
          </View>
        </View>

        <Text className="text-sm font-heebo text-neutral-500 text-right mt-6 mb-2">שיווק</Text>
        <View className="bg-neutral-50 rounded-2xl px-4">
          <View className="flex-row-reverse items-center justify-between py-4">
            <View className="flex-1 mr-3">
              <Text className="text-base font-heebo text-neutral-700 text-right">עדכונים ומבצעים</Text>
              <Text className="text-sm text-neutral-500 font-assistant text-right">
                קבלו עדכונים על תכונות חדשות והטבות
              </Text>
            </View>
            <Switch
              value={settings.marketing}
              onValueChange={() => handleToggle('marketing')}
              trackColor={{ true: '#2563EB', false: '#D1D5DB' }}
              thumbColor="white"
            />
          </View>
        </View>
      </View>

      {/* Save Button */}
      <View className="px-5 py-4 border-t border-neutral-100">
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
