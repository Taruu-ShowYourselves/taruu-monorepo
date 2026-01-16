import { useEffect, useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import { initializeApiClient } from '@sync/api-client';
import { useAuthStore, getAuthToken } from '@/stores/authStore';
import {
  registerForPushNotificationsAsync,
  useNotificationListeners,
  getNotificationData,
} from '@/lib/notifications';
import type { NotificationResponse } from 'expo-notifications';
import '../global.css';

function ApiClientInitializer({ children }: { children: React.ReactNode }) {
  const checkSession = useAuthStore((state) => state.checkSession);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const router = useRouter();

  useEffect(() => {
    // Initialize API client with token getter
    initializeApiClient({
      baseUrl: process.env.EXPO_PUBLIC_API_URL || 'https://sync.co.il',
      getToken: getAuthToken,
    });

    // Check for existing session on app start
    checkSession();
  }, [checkSession]);

  // Register for push notifications when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotificationsAsync().catch((error) => {
        console.error('Failed to register for push notifications:', error);
      });
    }
  }, [isAuthenticated]);

  // Handle notification tap to navigate to appropriate screen
  const handleNotificationResponse = useCallback(
    (response: NotificationResponse) => {
      const { screen, data } = getNotificationData(response);

      // Navigate based on notification data
      if (screen === 'verification' || data?.type === 'verification_reminder') {
        router.push('/verification');
      } else if (screen === 'vote' && data?.voteId) {
        router.push(`/vote/${data.voteId}`);
      }
      // Add more navigation handlers as needed
    },
    [router]
  );

  // Set up notification listeners
  useNotificationListeners({
    onNotificationReceived: (notification) => {
      // Notification received while app is in foreground
      console.log('Notification received:', notification.request.content.title);
    },
    onNotificationResponse: handleNotificationResponse,
  });

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ApiClientInitializer>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_left', // RTL
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="vote/[id]"
          options={{
            headerShown: true,
            headerTitle: 'פרטי הצבעה',
            headerBackTitle: 'חזרה',
          }}
        />
      </Stack>
    </ApiClientInitializer>
  );
}
