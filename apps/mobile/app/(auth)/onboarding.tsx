import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { usersApi } from '@sync/api-client';
import { MUNICIPALITIES } from '@sync/shared';

export default function OnboardingScreen() {
  const router = useRouter();
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleComplete = async () => {
    if (!selectedMunicipality) return;

    setLoading(true);
    setError('');

    try {
      await usersApi.createProfile({
        municipality: selectedMunicipality,
      });
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'שגיאה ביצירת הפרופיל');
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
            איפה אתם גרים?
          </Text>
          <Text className="text-lg text-neutral-600 font-assistant mb-6">
            בחרו את הרשות המקומית שלכם כדי לראות הצבעות רלוונטיות
          </Text>
        </Animated.View>

        {/* Municipality List */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          className="flex-1"
        >
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
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
                  <Text
                    className={`text-lg font-heebo ${
                      selectedMunicipality === municipality
                        ? 'text-primary-600 font-semibold'
                        : 'text-neutral-700'
                    }`}
                  >
                    {municipality}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </Animated.View>

        {/* Error */}
        {error ? (
          <Text className="text-red-500 text-center font-assistant mb-4">
            {error}
          </Text>
        ) : null}

        {/* Continue Button */}
        <Animated.View entering={FadeInUp.duration(400).delay(400)}>
          <Pressable
            className={`py-4 rounded-xl items-center mb-4 ${
              selectedMunicipality
                ? 'bg-primary-600 active:bg-primary-700'
                : 'bg-neutral-300'
            }`}
            onPress={handleComplete}
            disabled={!selectedMunicipality || loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-lg font-heebo font-semibold">
                המשך
              </Text>
            )}
          </Pressable>

          <Text className="text-center text-sm text-neutral-500 font-assistant">
            תוכלו לשנות את זה בהמשך בהגדרות
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
