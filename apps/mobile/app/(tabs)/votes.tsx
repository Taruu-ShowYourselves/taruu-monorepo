import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { votesApi } from '@sync/api-client';
import { Vote, VoteStatus } from '@sync/shared';
import { getTimeRemaining } from '@sync/shared';

type FilterType = 'all' | 'active' | 'ended' | 'pending';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'הכל' },
  { key: 'active', label: 'פעילות' },
  { key: 'ended', label: 'הסתיימו' },
  { key: 'pending', label: 'ממתינות' },
];

function VoteListItem({ vote, onPress }: { vote: Vote; onPress: () => void }) {
  const timeRemaining = getTimeRemaining(vote.endDate);
  const totalVotes = vote.options.reduce((sum, opt) => sum + opt.votes, 0);

  const statusColors = {
    active: { bg: 'bg-green-100', text: 'text-green-600' },
    ended: { bg: 'bg-neutral-100', text: 'text-neutral-600' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
  };

  const colors = statusColors[vote.status];

  return (
    <Pressable
      className="bg-white rounded-xl p-4 mb-2 border border-neutral-100 active:bg-neutral-50"
      onPress={onPress}
    >
      <View className="flex-row-reverse justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="text-base font-heebo font-semibold text-neutral-900 text-right" numberOfLines={1}>
            {vote.title}
          </Text>
          <Text className="text-sm text-neutral-500 font-assistant text-right mt-0.5">
            {vote.municipality} • {totalVotes} הצבעות
          </Text>
        </View>
        <View className={`${colors.bg} rounded-full px-2 py-0.5`}>
          <Text className={`${colors.text} text-xs font-heebo`}>
            {vote.status === 'active' ? timeRemaining : vote.status === 'ended' ? 'הסתיים' : 'ממתין'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function VotesScreen() {
  const router = useRouter();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchVotes = useCallback(async () => {
    try {
      const data = await votesApi.getVotes();
      setVotes(data);
    } catch (err) {
      console.error('Error fetching votes:', err);
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

  const filteredVotes = votes.filter((vote) => {
    // Filter by status
    if (filter !== 'all' && vote.status !== filter) return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        vote.title.toLowerCase().includes(query) ||
        vote.description.toLowerCase().includes(query) ||
        vote.municipality.toLowerCase().includes(query)
      );
    }

    return true;
  });

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="px-5 pt-4 pb-3">
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text className="text-2xl font-heebo font-bold text-neutral-900 text-right">
            כל ההצבעות
          </Text>
        </Animated.View>

        {/* Search */}
        <View className="mt-4 flex-row-reverse items-center bg-white rounded-xl border border-neutral-200 px-4">
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            className="flex-1 py-3 px-3 text-right font-assistant"
            placeholder="חיפוש הצבעות..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </Pressable>
          ) : null}
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3"
          contentContainerStyle={{ flexDirection: 'row-reverse' }}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              className={`px-4 py-2 rounded-full ml-2 ${
                filter === f.key ? 'bg-primary-600' : 'bg-white border border-neutral-200'
              }`}
              onPress={() => setFilter(f.key)}
            >
              <Text
                className={`font-heebo text-sm ${
                  filter === f.key ? 'text-white font-medium' : 'text-neutral-600'
                }`}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {filteredVotes.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="search" size={48} color="#D1D5DB" />
          <Text className="text-neutral-500 font-assistant text-center mt-4">
            לא נמצאו הצבעות
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
          }
        >
          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            <Text className="text-neutral-500 font-assistant text-right mb-2">
              {filteredVotes.length} הצבעות
            </Text>
            {filteredVotes.map((vote) => (
              <VoteListItem
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
