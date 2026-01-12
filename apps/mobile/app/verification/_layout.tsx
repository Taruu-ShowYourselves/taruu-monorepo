import { Stack } from 'expo-router';

export default function VerificationLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_left',
        contentStyle: { backgroundColor: '#fff' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="check-in" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
