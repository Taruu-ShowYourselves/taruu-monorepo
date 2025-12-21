import { Tabs } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-neutral-500">טוען...</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: {
          fontFamily: 'Heebo',
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'בית',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="votes"
        options={{
          title: 'הצבעות',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'יצירה',
          tabBarIcon: ({ color, size }) => (
            <View className="bg-primary-600 rounded-full p-3 -mt-4">
              <Ionicons name="add" size={24} color="white" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'פרופיל',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
