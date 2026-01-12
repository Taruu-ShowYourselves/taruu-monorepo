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
import { useUser, useVerificationStatus } from '@/stores/authStore';
import { getAuthToken } from '@/lib/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://sync.co.il';

interface VerificationData {
  verificationStatus: {
    phase: string;
    startedAt?: string;
    completedAt?: string;
    checkInsCompleted?: number;
    checkInsTotal?: number;
    nextCheckIn?: string;
  };
  progress?: {
    daysRemaining: number;
    daysElapsed: number;
    completedCheckIns: number;
    totalCheckIns: number;
    completionRate: number;
  };
  municipality?: string;
  nextCheckIn?: string;
}

export default function VerificationDashboard() {
  const router = useRouter();
  const user = useUser();
  const verificationStatus = useVerificationStatus();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [data, setData] = useState<VerificationData | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/verification/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching verification status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStatus();
  }, [fetchStatus]);

  const handleStartVerification = async () => {
    if (!user?.municipality) {
      Alert.alert(
        'נדרשת בחירת עירייה',
        'אנא בחרו עירייה בהגדרות לפני תחילת האימות',
        [
          { text: 'ביטול', style: 'cancel' },
          {
            text: 'להגדרות',
            onPress: () => router.push('/settings/municipality'),
          },
        ]
      );
      return;
    }

    setStarting(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('שגיאה', 'אינך מחובר');
        return;
      }

      const response = await fetch(`${API_URL}/api/verification/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        Alert.alert('הצלחה', 'תהליך האימות החל! תקבלו התראות לצ\'ק-אין GPS.', [
          { text: 'אישור', onPress: () => fetchStatus() },
        ]);
      } else {
        const error = await response.json();
        Alert.alert('שגיאה', error.error || 'לא ניתן להתחיל את תהליך האימות');
      }
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן להתחיל את תהליך האימות');
    } finally {
      setStarting(false);
    }
  };

  const handleCheckIn = () => {
    router.push('/verification/check-in');
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-3 text-neutral-500 font-assistant">טוען...</Text>
      </SafeAreaView>
    );
  }

  const status = data?.verificationStatus || verificationStatus;
  const progress = data?.progress;
  const isCheckInAvailable =
    status?.phase === 'in_progress' && data?.nextCheckIn;

  // Format next check-in time
  const nextCheckInDate = data?.nextCheckIn
    ? new Date(data.nextCheckIn)
    : null;
  const now = new Date();
  const isCheckInWindowOpen =
    nextCheckInDate &&
    now >= nextCheckInDate &&
    now <= new Date(nextCheckInDate.getTime() + 30 * 60 * 1000);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row-reverse items-center px-5 py-4 bg-white border-b border-neutral-100">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-forward" size={24} color="#374151" />
        </Pressable>
        <Text className="flex-1 text-lg font-heebo font-semibold text-neutral-900 text-right mr-4">
          אימות מגורים
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Status Card */}
        <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
          <View className="items-center mb-4">
            {status?.phase === 'not_started' && (
              <>
                <View className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-3">
                  <Ionicons name="location-outline" size={40} color="#6B7280" />
                </View>
                <Text className="text-xl font-heebo font-bold text-neutral-900 mb-1">
                  טרם התחלתם אימות
                </Text>
                <Text className="text-sm font-assistant text-neutral-500 text-center">
                  התחילו את תהליך אימות המגורים בן 21 הימים כדי להצביע בהצבעות
                  העירייה שלכם
                </Text>
              </>
            )}

            {status?.phase === 'in_progress' && (
              <>
                <View className="w-20 h-20 rounded-full bg-primary-100 items-center justify-center mb-3">
                  <Ionicons name="time-outline" size={40} color="#2563EB" />
                </View>
                <Text className="text-xl font-heebo font-bold text-neutral-900 mb-1">
                  אימות בתהליך
                </Text>
                <Text className="text-sm font-assistant text-neutral-500 text-center">
                  המשיכו לבצע צ'ק-אין כשתקבלו התראה
                </Text>
              </>
            )}

            {status?.phase === 'completed' && (
              <>
                <View className="w-20 h-20 rounded-full bg-secondary-100 items-center justify-center mb-3">
                  <Ionicons name="checkmark-circle" size={40} color="#10B981" />
                </View>
                <Text className="text-xl font-heebo font-bold text-neutral-900 mb-1">
                  אימות הושלם!
                </Text>
                <Text className="text-sm font-assistant text-neutral-500 text-center">
                  כעת אתם יכולים להצביע בהצבעות העירייה שלכם
                </Text>
              </>
            )}

            {status?.phase === 'failed' && (
              <>
                <View className="w-20 h-20 rounded-full bg-red-100 items-center justify-center mb-3">
                  <Ionicons name="close-circle" size={40} color="#DC2626" />
                </View>
                <Text className="text-xl font-heebo font-bold text-neutral-900 mb-1">
                  האימות נכשל
                </Text>
                <Text className="text-sm font-assistant text-neutral-500 text-center">
                  לא ביצעתם מספיק צ'ק-אינים. תוכלו להתחיל מחדש.
                </Text>
              </>
            )}
          </View>

          {/* Progress */}
          {status?.phase === 'in_progress' && progress && (
            <View className="border-t border-neutral-100 pt-4">
              <View className="flex-row-reverse justify-between mb-2">
                <Text className="text-sm font-assistant text-neutral-600">
                  התקדמות
                </Text>
                <Text className="text-sm font-heebo font-semibold text-neutral-900">
                  {progress.completedCheckIns}/{progress.totalCheckIns} צ'ק-אינים
                </Text>
              </View>
              <View className="h-3 bg-neutral-200 rounded-full overflow-hidden mb-3">
                <View
                  className="h-full bg-primary-500 rounded-full"
                  style={{ width: `${progress.completionRate * 100}%` }}
                />
              </View>
              <View className="flex-row-reverse justify-between">
                <Text className="text-xs font-assistant text-neutral-500">
                  {progress.daysElapsed} ימים עברו
                </Text>
                <Text className="text-xs font-assistant text-neutral-500">
                  {progress.daysRemaining} ימים נותרו
                </Text>
              </View>
            </View>
          )}

          {/* Actions */}
          <View className="mt-4">
            {status?.phase === 'not_started' && (
              <Pressable
                className="bg-primary-600 py-4 rounded-xl items-center active:bg-primary-700"
                onPress={handleStartVerification}
                disabled={starting}
              >
                {starting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-lg font-heebo font-semibold">
                    התחל אימות
                  </Text>
                )}
              </Pressable>
            )}

            {status?.phase === 'failed' && (
              <Pressable
                className="bg-primary-600 py-4 rounded-xl items-center active:bg-primary-700"
                onPress={handleStartVerification}
                disabled={starting}
              >
                {starting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-lg font-heebo font-semibold">
                    התחל מחדש
                  </Text>
                )}
              </Pressable>
            )}

            {status?.phase === 'completed' && (
              <Pressable
                className="bg-secondary-600 py-4 rounded-xl items-center active:bg-secondary-700"
                onPress={() => router.push('/(tabs)')}
              >
                <Text className="text-white text-lg font-heebo font-semibold">
                  צפו בהצבעות
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Next Check-in */}
        {status?.phase === 'in_progress' && nextCheckInDate && (
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
            <Text className="text-lg font-heebo font-semibold text-neutral-900 text-right mb-3">
              הצ'ק-אין הבא
            </Text>

            {isCheckInWindowOpen ? (
              <>
                <View className="flex-row-reverse items-center bg-secondary-50 p-4 rounded-xl mb-3">
                  <Ionicons name="location" size={24} color="#10B981" />
                  <Text className="flex-1 text-base font-assistant text-secondary-700 text-right mr-3">
                    חלון הצ'ק-אין פתוח! בצעו צ'ק-אין עכשיו.
                  </Text>
                </View>
                <Pressable
                  className="bg-secondary-600 py-4 rounded-xl items-center active:bg-secondary-700"
                  onPress={handleCheckIn}
                >
                  <Text className="text-white text-lg font-heebo font-semibold">
                    בצע צ'ק-אין
                  </Text>
                </Pressable>
              </>
            ) : (
              <View className="flex-row-reverse items-center bg-neutral-50 p-4 rounded-xl">
                <Ionicons name="time-outline" size={24} color="#6B7280" />
                <View className="flex-1 mr-3">
                  <Text className="text-base font-heebo text-neutral-900 text-right">
                    {nextCheckInDate.toLocaleDateString('he-IL', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                  <Text className="text-sm font-assistant text-neutral-500 text-right">
                    {nextCheckInDate.toLocaleTimeString('he-IL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* How it works */}
        <View className="bg-neutral-100 rounded-2xl p-5">
          <Text className="text-lg font-heebo font-semibold text-neutral-900 text-right mb-4">
            איך זה עובד?
          </Text>

          <View className="mb-3">
            <View className="flex-row-reverse items-start">
              <View className="w-6 h-6 rounded-full bg-primary-100 items-center justify-center">
                <Text className="text-xs font-heebo font-bold text-primary-600">1</Text>
              </View>
              <View className="flex-1 mr-3">
                <Text className="text-sm font-heebo font-semibold text-neutral-900 text-right">
                  התחילו את התהליך
                </Text>
                <Text className="text-sm font-assistant text-neutral-600 text-right">
                  לחצו על "התחל אימות" כדי להתחיל את 21 ימי האימות
                </Text>
              </View>
            </View>
          </View>

          <View className="mb-3">
            <View className="flex-row-reverse items-start">
              <View className="w-6 h-6 rounded-full bg-primary-100 items-center justify-center">
                <Text className="text-xs font-heebo font-bold text-primary-600">2</Text>
              </View>
              <View className="flex-1 mr-3">
                <Text className="text-sm font-heebo font-semibold text-neutral-900 text-right">
                  קבלו התראות
                </Text>
                <Text className="text-sm font-assistant text-neutral-600 text-right">
                  תקבלו 5-7 התראות אקראיות במהלך התקופה לביצוע צ'ק-אין GPS
                </Text>
              </View>
            </View>
          </View>

          <View className="mb-3">
            <View className="flex-row-reverse items-start">
              <View className="w-6 h-6 rounded-full bg-primary-100 items-center justify-center">
                <Text className="text-xs font-heebo font-bold text-primary-600">3</Text>
              </View>
              <View className="flex-1 mr-3">
                <Text className="text-sm font-heebo font-semibold text-neutral-900 text-right">
                  בצעו צ'ק-אין
                </Text>
                <Text className="text-sm font-assistant text-neutral-600 text-right">
                  יש לכם 30 דקות לבצע צ'ק-אין מתוך גבולות העירייה שלכם
                </Text>
              </View>
            </View>
          </View>

          <View>
            <View className="flex-row-reverse items-start">
              <View className="w-6 h-6 rounded-full bg-secondary-100 items-center justify-center">
                <Ionicons name="checkmark" size={14} color="#10B981" />
              </View>
              <View className="flex-1 mr-3">
                <Text className="text-sm font-heebo font-semibold text-neutral-900 text-right">
                  קבלו הרשאת הצבעה
                </Text>
                <Text className="text-sm font-assistant text-neutral-600 text-right">
                  לאחר השלמת 80% מהצ'ק-אינים, תוכלו להצביע בהצבעות העירייה
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
