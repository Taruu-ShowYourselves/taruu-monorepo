import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { initializeApiClient } from '@sync/api-client';
import { useAuthStore, getAuthToken } from '@/stores/authStore';
import '../global.css';

function ApiClientInitializer({ children }: { children: React.ReactNode }) {
  const checkSession = useAuthStore((state) => state.checkSession);

  useEffect(() => {
    // Initialize API client with token getter
    initializeApiClient({
      baseUrl: process.env.EXPO_PUBLIC_API_URL || 'https://sync.co.il',
      getToken: getAuthToken,
    });

    // Check for existing session on app start
    checkSession();
  }, [checkSession]);

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
