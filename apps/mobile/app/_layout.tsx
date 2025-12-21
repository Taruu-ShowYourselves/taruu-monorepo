import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { tokenCache } from '@/lib/auth';
import { initializeApiClient } from '@sync/api-client';
import { useAuth } from '@clerk/clerk-expo';
import '../global.css';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
}

function ApiClientInitializer({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    initializeApiClient({
      baseUrl: process.env.EXPO_PUBLIC_API_URL || 'https://sync.co.il',
      getToken: async () => {
        try {
          return await getToken();
        } catch {
          return null;
        }
      },
    });
  }, [getToken]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
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
      </ClerkLoaded>
    </ClerkProvider>
  );
}
