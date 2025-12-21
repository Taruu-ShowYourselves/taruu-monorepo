import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { votesApi } from '@sync/api-client';
import { Vote } from '@sync/shared';
import { formatCurrency, getTimeRemaining } from '@sync/shared';

function VoteCard({ vote, onPress }: { vote: Vote; onPress: () => void }) {
  const timeRemaining = getTimeRemaining(vote.endDate);
  const totalVotes = vote.options.reduce((sum, opt) => sum + opt.votes, 0);

  return (
    <Pressable
      className="bg-white rounded-2xl p-4 mb-3 border border-neutral-100 active:scale-98"
      onPress={onPress}
      style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}
    >
      <View className="flex-row-reverse justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-lg font-heebo font-semibold text-neutral-900 text-right">
            {vote.title}
          </Text>
          <Text className="text-sm text-neutral-500 font-assistant text-right mt-1">
            {vote.municipality}
          </Text>
        </View>
        <View className="bg-primary-100 rounded-full px-3 py-1 mr-3">
          <Text className="text-primary-600 text-xs font-heebo font-medium">
            {vote.status === 'active' ? 'פעיל' : vote.status === 'ended' ? 'הסתיים' : 'ממתין'}
          </Text>
        </View>
      </View>

      <Text className="text-neutral-600 font-assistant text-right mb-3" numberOfLines={2}>
        {vote.description}
      </Text>

      <View className="flex-row-reverse justify-between items-center">
        <View className="flex-row-reverse items-center">
          <Ionicons name="people" size={16} color="#6B7280" />
          <Text className="text-neutral-500 text-sm font-assistant mr-1">
            {totalVotes} הצבעות
          </Text>
        </View>
        <View className="flex-row-reverse items-center">
          <Ionicons name="time" size={16} color="#6B7280" />
          <Text className="text-neutral-500 text-sm font-assistant mr-1">
            {timeRemaining}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchVotes = useCallback(async () => {
    try {
      const data = await votesApi.getActiveVotes();
      setVotes(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת ההצבעות');
    }
  }, []);

  useEffect(() => {
    fetchVotes().finally(() => setLoading(false));
  }, [fetchVotes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchVotes();
    setRefreshing(false);
  }, [fetchVotes]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="px-5 pt-4 pb-2">
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text className="text-2xl font-heebo font-bold text-neutral-900 text-right">
            הצבעות פעילות
          </Text>
          <Text className="text-neutral-500 font-assistant text-right mt-1">
            הצביעו על נושאים שחשובים לכם
          </Text>
        </Animated.View>
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="cloud-offline" size={48} color="#9CA3AF" />
          <Text className="text-neutral-500 font-assistant text-center mt-4">{error}</Text>
          <Pressable
            className="mt-4 bg-primary-600 px-6 py-3 rounded-xl"
            onPress={fetchVotes}
          >
            <Text className="text-white font-heebo font-medium">נסו שוב</Text>
          </Pressable>
        </View>
      ) : votes.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="checkmark-done-circle" size={64} color="#D1D5DB" />
          <Text className="text-xl font-heebo font-semibold text-neutral-700 text-center mt-4">
            אין הצבעות פעילות
          </Text>
          <Text className="text-neutral-500 font-assistant text-center mt-2">
            כרגע אין הצבעות פעילות באזור שלכם
          </Text>
          <Pressable
            className="mt-6 bg-primary-600 px-6 py-3 rounded-xl flex-row-reverse items-center"
            onPress={() => router.push('/(tabs)/create')}
          >
            <Ionicons name="add" size={20} color="white" />
            <Text className="text-white font-heebo font-medium mr-2">יצירת הצבעה חדשה</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
          }
        >
          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            {votes.map((vote, index) => (
              <VoteCard
                key={vote.id}
                vote={vote}
                onPress={() => router.push(`/vote/${vote.id}`)}
              />
            ))}
          </Animated.View>
          <View className="h-6" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
