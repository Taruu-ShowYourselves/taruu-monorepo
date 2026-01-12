import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { getAuthToken } from '@/lib/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://sync.co.il';

type CheckInPhase = 'requesting' | 'locating' | 'verifying' | 'success' | 'error';

export default function CheckInScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<CheckInPhase>('requesting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const pulseScale = useSharedValue(1);

  // Pulse animation
  useEffect(() => {
    pulseScale.value = withRepeat(
      withTiming(1.2, { duration: 1000, easing: Easing.ease }),
      -1,
      true
    );
  }, [pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Request location permission and get location
  useEffect(() => {
    const getLocation = async () => {
      try {
        // Request permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPhase('error');
          setErrorMessage('נדרשת הרשאת מיקום לביצוע צ\'ק-אין');
          return;
        }

        setPhase('locating');

        // Get current location with high accuracy
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        setLocation(loc);
        await verifyCheckIn(loc);
      } catch (error) {
        console.error('Location error:', error);
        setPhase('error');
        setErrorMessage('לא ניתן לקבל את המיקום. נסו שוב.');
      }
    };

    getLocation();
  }, []);

  const verifyCheckIn = async (loc: Location.LocationObject) => {
    setPhase('verifying');

    try {
      const token = await getAuthToken();
      if (!token) {
        setPhase('error');
        setErrorMessage('אינך מחובר');
        return;
      }

      const response = await fetch(`${API_URL}/api/verification/check-in`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
        }),
      });

      const result = await response.json();

      if (response.ok && result.verified) {
        setPhase('success');
      } else {
        setPhase('error');
        setErrorMessage(result.error || 'האימות נכשל');
      }
    } catch (error) {
      console.error('Check-in error:', error);
      setPhase('error');
      setErrorMessage('שגיאה בביצוע הצ\'ק-אין. נסו שוב.');
    }
  };

  const handleRetry = async () => {
    setPhase('requesting');
    setErrorMessage(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPhase('error');
        setErrorMessage('נדרשת הרשאת מיקום לביצוע צ\'ק-אין');
        return;
      }

      setPhase('locating');
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(loc);
      await verifyCheckIn(loc);
    } catch (error) {
      setPhase('error');
      setErrorMessage('לא ניתן לקבל את המיקום. נסו שוב.');
    }
  };

  const getStatusIcon = () => {
    switch (phase) {
      case 'requesting':
        return <Ionicons name="shield-outline" size={60} color="#2563EB" />;
      case 'locating':
        return <Ionicons name="locate-outline" size={60} color="#2563EB" />;
      case 'verifying':
        return <Ionicons name="sync-outline" size={60} color="#2563EB" />;
      case 'success':
        return <Ionicons name="checkmark-circle" size={60} color="#10B981" />;
      case 'error':
        return <Ionicons name="close-circle" size={60} color="#DC2626" />;
    }
  };

  const getStatusText = () => {
    switch (phase) {
      case 'requesting':
        return 'מבקש הרשאת מיקום...';
      case 'locating':
        return 'מאתר מיקום...';
      case 'verifying':
        return 'מאמת צ\'ק-אין...';
      case 'success':
        return 'צ\'ק-אין הושלם בהצלחה!';
      case 'error':
        return 'הצ\'ק-אין נכשל';
    }
  };

  const getStatusDescription = () => {
    switch (phase) {
      case 'requesting':
        return 'אנא אשרו גישה למיקום כדי לאמת את הימצאותכם בעירייה';
      case 'locating':
        return 'מקבל נתוני GPS מדויקים...';
      case 'verifying':
        return 'בודק שאתם נמצאים בגבולות העירייה';
      case 'success':
        return 'המיקום שלכם אומת בהצלחה. המשיכו כך!';
      case 'error':
        return errorMessage || 'אירעה שגיאה בתהליך';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row-reverse items-center px-5 py-4 border-b border-neutral-100">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="close" size={24} color="#374151" />
        </Pressable>
        <Text className="flex-1 text-lg font-heebo font-semibold text-neutral-900 text-right mr-4">
          צ'ק-אין GPS
        </Text>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        {/* Animated status indicator */}
        <View className="items-center mb-8">
          {phase === 'locating' || phase === 'verifying' || phase === 'requesting' ? (
            <View className="items-center justify-center">
              <Animated.View
                style={[
                  {
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: '#DBEAFE',
                    position: 'absolute',
                  },
                  pulseStyle,
                ]}
              />
              <View className="w-28 h-28 rounded-full bg-primary-100 items-center justify-center">
                {getStatusIcon()}
              </View>
            </View>
          ) : (
            <View
              className={`w-28 h-28 rounded-full items-center justify-center ${
                phase === 'success' ? 'bg-secondary-100' : 'bg-red-100'
              }`}
            >
              {getStatusIcon()}
            </View>
          )}
        </View>

        {/* Status text */}
        <Text className="text-2xl font-heebo font-bold text-neutral-900 mb-2 text-center">
          {getStatusText()}
        </Text>
        <Text className="text-base font-assistant text-neutral-500 text-center mb-8">
          {getStatusDescription()}
        </Text>

        {/* Location info */}
        {location && phase !== 'requesting' && (
          <View className="bg-neutral-50 rounded-xl p-4 w-full mb-6">
            <Text className="text-sm font-assistant text-neutral-500 text-right mb-2">
              נתוני מיקום
            </Text>
            <View className="flex-row-reverse justify-between">
              <Text className="text-sm font-assistant text-neutral-600">רוחב:</Text>
              <Text className="text-sm font-heebo text-neutral-900">
                {location.coords.latitude.toFixed(6)}
              </Text>
            </View>
            <View className="flex-row-reverse justify-between">
              <Text className="text-sm font-assistant text-neutral-600">אורך:</Text>
              <Text className="text-sm font-heebo text-neutral-900">
                {location.coords.longitude.toFixed(6)}
              </Text>
            </View>
            {location.coords.accuracy && (
              <View className="flex-row-reverse justify-between">
                <Text className="text-sm font-assistant text-neutral-600">דיוק:</Text>
                <Text className="text-sm font-heebo text-neutral-900">
                  {Math.round(location.coords.accuracy)} מטרים
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Loading indicator */}
        {(phase === 'locating' || phase === 'verifying' || phase === 'requesting') && (
          <ActivityIndicator size="large" color="#2563EB" />
        )}

        {/* Actions */}
        <View className="w-full mt-8">
          {phase === 'success' && (
            <Pressable
              className="bg-secondary-600 py-4 rounded-xl items-center active:bg-secondary-700"
              onPress={() => router.replace('/verification')}
            >
              <Text className="text-white text-lg font-heebo font-semibold">
                חזרה ללוח הבקרה
              </Text>
            </Pressable>
          )}

          {phase === 'error' && (
            <>
              <Pressable
                className="bg-primary-600 py-4 rounded-xl items-center active:bg-primary-700 mb-3"
                onPress={handleRetry}
              >
                <Text className="text-white text-lg font-heebo font-semibold">
                  נסה שוב
                </Text>
              </Pressable>
              <Pressable
                className="py-3 items-center"
                onPress={() => router.back()}
              >
                <Text className="text-neutral-500 font-heebo">ביטול</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Tips */}
      {phase === 'error' && (
        <View className="px-5 pb-6">
          <View className="bg-amber-50 rounded-xl p-4">
            <View className="flex-row-reverse items-start">
              <Ionicons name="bulb-outline" size={20} color="#D97706" />
              <View className="flex-1 mr-2">
                <Text className="text-sm font-heebo font-semibold text-amber-800 text-right mb-1">
                  טיפים לשיפור דיוק GPS
                </Text>
                <Text className="text-sm font-assistant text-amber-700 text-right">
                  • צאו לאזור פתוח, רחוק ממבנים גבוהים{'\n'}
                  • ודאו שה-GPS מופעל בהגדרות המכשיר{'\n'}
                  • נסו להפעיל מחדש את המיקום במכשיר
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
