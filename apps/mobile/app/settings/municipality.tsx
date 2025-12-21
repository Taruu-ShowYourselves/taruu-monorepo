import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usersApi } from '@sync/api-client';
import { MUNICIPALITIES } from '@sync/shared';

export default function ChangeMunicipalityScreen() {
  const router = useRouter();
  const [currentMunicipality, setCurrentMunicipality] = useState<string | null>(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await usersApi.getProfile();
        setCurrentMunicipality(profile.municipality);
        setSelectedMunicipality(profile.municipality);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async () => {
    if (!selectedMunicipality || selectedMunicipality === currentMunicipality) {
      router.back();
      return;
    }

    setSaving(true);
    try {
      await usersApi.updateProfile({ municipality: selectedMunicipality });
      Alert.alert('הצלחה', 'הרשות המקומית עודכנה בהצלחה', [
        { text: 'אישור', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('שגיאה', err.message || 'לא ניתן לעדכן את הרשות');
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
          שינוי רשות מקומית
        </Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        <Text className="text-neutral-600 font-assistant text-right mb-4">
          בחרו את הרשות המקומית שלכם. ההצבעות שתראו יהיו רלוונטיות לרשות שתבחרו.
        </Text>

        <View className="gap-2">
          {MUNICIPALITIES.map((municipality) => (
            <Pressable
              key={municipality}
              className={`p-4 rounded-xl border-2 ${
                selectedMunicipality === municipality
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-neutral-200 bg-white'
              }`}
              onPress={() => setSelectedMunicipality(municipality)}
            >
              <View className="flex-row-reverse items-center justify-between">
                <Text
                  className={`text-lg font-heebo ${
                    selectedMunicipality === municipality
                      ? 'text-primary-600 font-semibold'
                      : 'text-neutral-700'
                  }`}
                >
                  {municipality}
                </Text>
                {selectedMunicipality === municipality && (
                  <Ionicons name="checkmark-circle" size={24} color="#2563EB" />
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

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
