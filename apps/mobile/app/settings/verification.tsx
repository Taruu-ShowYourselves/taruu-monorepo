import { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { usersApi } from '@sync/api-client';

type VerificationStep = 'email' | 'phone' | 'location' | 'identity';

interface VerificationStatus {
  email: boolean;
  phone: boolean;
  location: boolean;
  identity: boolean;
}

export default function VerificationScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<VerificationStatus>({
    email: false,
    phone: false,
    location: false,
    identity: false,
  });
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<VerificationStep | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const profile = await usersApi.getProfile();
        if (profile.verificationStatus) {
          setStatus(profile.verificationStatus);
        }
      } catch (err) {
        console.error('Error fetching verification status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  const handleVerifyLocation = async () => {
    setVerifying('location');
    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert('הרשאה נדרשת', 'יש לאשר גישה למיקום כדי לאמת את המיקום');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await usersApi.verifyLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setStatus((prev) => ({ ...prev, location: true }));
      Alert.alert('הצלחה', 'המיקום אומת בהצלחה');
    } catch (err: any) {
      Alert.alert('שגיאה', err.message || 'לא ניתן לאמת את המיקום');
    } finally {
      setVerifying(null);
    }
  };

  const getCompletionPercentage = () => {
    const completed = Object.values(status).filter(Boolean).length;
    return Math.round((completed / 4) * 100);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  const completionPercentage = getCompletionPercentage();

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row-reverse items-center px-5 py-4 border-b border-neutral-100">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-forward" size={24} color="#374151" />
        </Pressable>
        <Text className="flex-1 text-lg font-heebo font-semibold text-neutral-900 text-right mr-4">
          אימות זהות
        </Text>
      </View>

      <View className="flex-1 px-5 pt-6">
        {/* Progress */}
        <View className="bg-primary-50 rounded-2xl p-4 mb-6">
          <View className="flex-row-reverse justify-between items-center mb-2">
            <Text className="font-heebo text-neutral-700">השלמת אימות</Text>
            <Text className="font-heebo font-bold text-primary-600">{completionPercentage}%</Text>
          </View>
          <View className="h-2 bg-white rounded-full overflow-hidden">
            <View
              className="h-2 bg-primary-600 rounded-full"
              style={{ width: `${completionPercentage}%` }}
            />
          </View>
        </View>

        <Text className="text-neutral-600 font-assistant text-right mb-6">
          אימות הזהות מגביר את האמינות של ההצבעות שלכם ומאפשר תכונות נוספות.
        </Text>

        {/* Verification Steps */}
        <View className="gap-3">
          {/* Email */}
          <View className="bg-neutral-50 rounded-xl p-4 flex-row-reverse items-center">
            <View
              className={`w-10 h-10 rounded-full items-center justify-center ${
                status.email ? 'bg-green-100' : 'bg-neutral-200'
              }`}
            >
              <Ionicons
                name={status.email ? 'checkmark' : 'mail'}
                size={20}
                color={status.email ? '#10B981' : '#6B7280'}
              />
            </View>
            <View className="flex-1 mr-3">
              <Text className="font-heebo text-neutral-700 text-right">אימות אימייל</Text>
              <Text className="text-sm text-neutral-500 font-assistant text-right">
                {status.email ? 'אומת' : 'האימייל שלכם יאומת בעת ההרשמה'}
              </Text>
            </View>
            {status.email && <Ionicons name="checkmark-circle" size={24} color="#10B981" />}
          </View>

          {/* Phone */}
          <Pressable
            className={`bg-neutral-50 rounded-xl p-4 flex-row-reverse items-center ${
              !status.phone ? 'active:bg-neutral-100' : ''
            }`}
            disabled={status.phone}
          >
            <View
              className={`w-10 h-10 rounded-full items-center justify-center ${
                status.phone ? 'bg-green-100' : 'bg-neutral-200'
              }`}
            >
              <Ionicons
                name={status.phone ? 'checkmark' : 'call'}
                size={20}
                color={status.phone ? '#10B981' : '#6B7280'}
              />
            </View>
            <View className="flex-1 mr-3">
              <Text className="font-heebo text-neutral-700 text-right">אימות טלפון</Text>
              <Text className="text-sm text-neutral-500 font-assistant text-right">
                {status.phone ? 'אומת' : 'אמתו את מספר הטלפון שלכם'}
              </Text>
            </View>
            {status.phone ? (
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            ) : (
              <Ionicons name="chevron-back" size={20} color="#9CA3AF" />
            )}
          </Pressable>

          {/* Location */}
          <Pressable
            className={`bg-neutral-50 rounded-xl p-4 flex-row-reverse items-center ${
              !status.location ? 'active:bg-neutral-100' : ''
            }`}
            onPress={handleVerifyLocation}
            disabled={status.location || verifying === 'location'}
          >
            <View
              className={`w-10 h-10 rounded-full items-center justify-center ${
                status.location ? 'bg-green-100' : 'bg-neutral-200'
              }`}
            >
              {verifying === 'location' ? (
                <ActivityIndicator size="small" color="#6B7280" />
              ) : (
                <Ionicons
                  name={status.location ? 'checkmark' : 'location'}
                  size={20}
                  color={status.location ? '#10B981' : '#6B7280'}
                />
              )}
            </View>
            <View className="flex-1 mr-3">
              <Text className="font-heebo text-neutral-700 text-right">אימות מיקום</Text>
              <Text className="text-sm text-neutral-500 font-assistant text-right">
                {status.location ? 'אומת' : 'אמתו שאתם נמצאים ברשות המקומית'}
              </Text>
            </View>
            {status.location ? (
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            ) : verifying !== 'location' ? (
              <Ionicons name="chevron-back" size={20} color="#9CA3AF" />
            ) : null}
          </Pressable>

          {/* Identity */}
          <Pressable
            className={`bg-neutral-50 rounded-xl p-4 flex-row-reverse items-center ${
              !status.identity ? 'active:bg-neutral-100' : ''
            }`}
            disabled={status.identity}
          >
            <View
              className={`w-10 h-10 rounded-full items-center justify-center ${
                status.identity ? 'bg-green-100' : 'bg-neutral-200'
              }`}
            >
              <Ionicons
                name={status.identity ? 'checkmark' : 'id-card'}
                size={20}
                color={status.identity ? '#10B981' : '#6B7280'}
              />
            </View>
            <View className="flex-1 mr-3">
              <Text className="font-heebo text-neutral-700 text-right">אימות תעודת זהות</Text>
              <Text className="text-sm text-neutral-500 font-assistant text-right">
                {status.identity ? 'אומת' : 'בקרוב - אימות מתקדם עם תעודת זהות'}
              </Text>
            </View>
            {status.identity ? (
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            ) : (
              <View className="bg-yellow-100 px-2 py-1 rounded">
                <Text className="text-yellow-700 text-xs font-heebo">בקרוב</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
