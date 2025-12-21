import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_left',
      }}
    >
      <Stack.Screen name="profile" />
      <Stack.Screen name="municipality" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="verification" />
    </Stack>
  );
}
