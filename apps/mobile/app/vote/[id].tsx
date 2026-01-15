import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { votesApi } from '@sync/api-client';
import { Vote, VoteOption, VOTE_COST, formatCurrency, getTimeRemaining } from '@sync/shared';
import { shareVote } from '@/lib/share';

function OptionCard({
  option,
  totalVotes,
  selected,
  onSelect,
  disabled,
  voted,
}: {
  option: VoteOption;
  totalVotes: number;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
  voted: boolean;
}) {
  const optionVotes = option.voteCount || option.votes || 0;
  const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;

  return (
    <Pressable
      className={`rounded-xl p-4 mb-3 border-2 ${
        selected
          ? 'border-primary-600 bg-primary-50'
          : voted
          ? 'border-neutral-200 bg-neutral-50'
          : 'border-neutral-200 bg-white active:bg-neutral-50'
      }`}
      onPress={onSelect}
      disabled={disabled || voted}
    >
      <View className="flex-row-reverse justify-between items-center mb-2">
        <Text
          className={`flex-1 text-base font-heebo text-right ${
            selected ? 'text-primary-600 font-semibold' : 'text-neutral-700'
          }`}
        >
          {option.label || option.text}
        </Text>
        {(voted || selected) && (
          <View
            className={`w-6 h-6 rounded-full items-center justify-center ml-3 ${
              selected ? 'bg-primary-600' : 'bg-neutral-300'
            }`}
          >
            <Ionicons name="checkmark" size={16} color="white" />
          </View>
        )}
      </View>

      {/* Progress bar (visible after voting or when ended) */}
      {voted && (
        <>
          <View className="h-2 bg-neutral-200 rounded-full overflow-hidden">
            <Animated.View
              entering={FadeInDown.duration(500)}
              className="h-2 bg-primary-600 rounded-full"
              style={{ width: `${percentage}%` }}
            />
          </View>
          <View className="flex-row-reverse justify-between mt-2">
            <Text className="text-sm text-neutral-500 font-assistant">{optionVotes} הצבעות</Text>
            <Text className="text-sm font-heebo font-medium text-primary-600">{percentage}%</Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

export default function VoteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vote, setVote] = useState<Vote | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [locationVerified, setLocationVerified] = useState(false);
  const [verifyingLocation, setVerifyingLocation] = useState(false);

  const fetchVote = useCallback(async () => {
    try {
      const data = await votesApi.getVote(id);
      setVote(data);
      // Check if user already voted
      if (data.userVote) {
        setHasVoted(true);
        // userVote is the optionId directly
        setSelectedOption(data.userVote);
      }
    } catch (err) {
      console.error('Error fetching vote:', err);
      Alert.alert('שגיאה', 'לא ניתן לטעון את ההצבעה', [
        { text: 'חזרה', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchVote();
  }, [fetchVote]);

  const verifyLocation = async () => {
    setVerifyingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('הרשאת מיקום', 'יש לאשר גישה למיקום כדי להצביע');
        return false;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // In a real app, this would verify against municipality boundaries
      // For now, we'll simulate verification
      const isInMunicipality = await votesApi.verifyLocation({
        voteId: id,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (!isInMunicipality) {
        Alert.alert(
          'אימות מיקום נכשל',
          'נראה שאתם לא נמצאים בתחום הרשות המקומית הרלוונטית להצבעה זו'
        );
        return false;
      }

      setLocationVerified(true);
      return true;
    } catch (_err) {
      Alert.alert('שגיאה', 'לא ניתן לאמת את המיקום שלכם');
      return false;
    } finally {
      setVerifyingLocation(false);
    }
  };

  const handleVote = async () => {
    if (!selectedOption || !vote) return;

    // First verify location if not already verified
    if (!locationVerified) {
      const verified = await verifyLocation();
      if (!verified) return;
    }

    // Navigate to Stripe payment screen with vote details
    router.push({
      pathname: '/payment/checkout',
      params: {
        type: 'vote',
        voteId: id,
        optionId: selectedOption,
        voteTitle: vote.title,
        returnPath: `/vote/${id}`,
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  if (!vote) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 items-center justify-center">
        <Text className="text-neutral-500">ההצבעה לא נמצאה</Text>
      </SafeAreaView>
    );
  }

  const totalVotes = vote.options.reduce((sum, opt) => sum + (opt.voteCount || opt.votes || 0), 0);
  const isActive = vote.status === 'active';
  const timeRemaining = getTimeRemaining(vote.endDate);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      {/* Header */}
      <View className="flex-row-reverse items-center px-5 py-4 bg-white border-b border-neutral-100">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-forward" size={24} color="#374151" />
        </Pressable>
        <Text className="flex-1 text-lg font-heebo font-semibold text-neutral-900 text-right mr-4" numberOfLines={1}>
          {vote.title}
        </Text>
        <Pressable
          className="p-1"
          onPress={() => shareVote(id, vote.title)}
        >
          <Ionicons name="share-outline" size={24} color="#374151" />
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Vote Info */}
        <Animated.View entering={FadeInDown.duration(400)} className="bg-white px-5 py-4 mb-2">
          <View className="flex-row-reverse justify-between items-center mb-3">
            <View
              className={`px-3 py-1 rounded-full ${
                isActive ? 'bg-green-100' : 'bg-neutral-100'
              }`}
            >
              <Text
                className={`text-sm font-heebo ${
                  isActive ? 'text-green-600' : 'text-neutral-600'
                }`}
              >
                {isActive ? `נותרו ${timeRemaining}` : 'ההצבעה הסתיימה'}
              </Text>
            </View>
            <Text className="text-neutral-500 font-assistant text-sm">
              {vote.municipality}
            </Text>
          </View>

          <Text className="text-xl font-heebo font-bold text-neutral-900 text-right mb-2">
            {vote.title}
          </Text>
          <Text className="text-neutral-600 font-assistant text-right leading-6">
            {vote.description}
          </Text>

          {/* Stats */}
          <View className="flex-row-reverse mt-4 pt-4 border-t border-neutral-100">
            <View className="flex-1 items-center">
              <Text className="text-2xl font-heebo font-bold text-primary-600">{totalVotes}</Text>
              <Text className="text-sm text-neutral-500 font-assistant">הצבעות</Text>
            </View>
            <View className="w-px bg-neutral-200" />
            <View className="flex-1 items-center">
              <Text className="text-2xl font-heebo font-bold text-neutral-700">
                {vote.options.length}
              </Text>
              <Text className="text-sm text-neutral-500 font-assistant">אפשרויות</Text>
            </View>
          </View>
        </Animated.View>

        {/* Location Verification Status */}
        {isActive && !hasVoted && (
          <Animated.View entering={FadeInDown.duration(400).delay(100)} className="mx-5 mb-2">
            <Pressable
              className={`flex-row-reverse items-center p-4 rounded-xl border ${
                locationVerified
                  ? 'bg-green-50 border-green-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}
              onPress={locationVerified ? undefined : verifyLocation}
              disabled={verifyingLocation || locationVerified}
            >
              {verifyingLocation ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Ionicons
                  name={locationVerified ? 'checkmark-circle' : 'location'}
                  size={24}
                  color={locationVerified ? '#10B981' : '#F59E0B'}
                />
              )}
              <View className="flex-1 mr-3">
                <Text
                  className={`font-heebo text-right ${
                    locationVerified ? 'text-green-700' : 'text-yellow-700'
                  }`}
                >
                  {locationVerified ? 'המיקום אומת' : 'אימות מיקום נדרש'}
                </Text>
                <Text
                  className={`text-sm font-assistant text-right ${
                    locationVerified ? 'text-green-600' : 'text-yellow-600'
                  }`}
                >
                  {locationVerified
                    ? 'אתם נמצאים בתחום הרשות'
                    : 'לחצו לאימות המיקום שלכם'}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Options */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} className="px-5 py-4">
          <Text className="text-lg font-heebo font-semibold text-neutral-900 text-right mb-3">
            {hasVoted ? 'תוצאות' : 'אפשרויות'}
          </Text>

          {vote.options.map((option) => (
            <OptionCard
              key={option.id}
              option={option}
              totalVotes={totalVotes}
              selected={selectedOption === option.id}
              onSelect={() => setSelectedOption(option.id)}
              disabled={!isActive}
              voted={hasVoted}
            />
          ))}
        </Animated.View>

        {/* Vote Creator */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)} className="px-5 pb-6">
          <View className="bg-neutral-100 rounded-xl p-4">
            <Text className="text-sm text-neutral-500 font-assistant text-right mb-1">
              נוצר על ידי
            </Text>
            <Text className="text-base font-heebo text-neutral-700 text-right">
              {vote.creator?.displayName || (vote.creator?.firstName ? `${vote.creator.firstName} ${vote.creator.lastName || ''}`.trim() : 'אנונימי')}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Vote Button */}
      {isActive && !hasVoted && (
        <Animated.View entering={FadeInUp.duration(400)} className="px-5 pb-6 pt-2 bg-white border-t border-neutral-100">
          <View className="flex-row-reverse items-center mb-2">
            <Ionicons name="information-circle" size={16} color="#9CA3AF" />
            <Text className="text-sm text-neutral-500 font-assistant mr-2">
              עלות הצבעה: {formatCurrency(VOTE_COST)} • נרשם בבלוקצ'יין
            </Text>
          </View>
          <Text className="text-xs text-neutral-400 font-assistant text-center mb-3">
            דמי ההשתתפות מחזקים פעולה קהילתית ושקיפות—לא "תשלום עבור דעה".
          </Text>
          <Pressable
            className={`py-4 rounded-xl items-center ${
              selectedOption
                ? 'bg-primary-600 active:bg-primary-700'
                : 'bg-neutral-300'
            }`}
            onPress={handleVote}
            disabled={!selectedOption}
          >
            <Text className="text-white text-lg font-heebo font-semibold">
              הצביעו עכשיו
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Already Voted Message */}
      {hasVoted && (
        <Animated.View entering={FadeInUp.duration(400)} className="px-5 pb-6 pt-2 bg-white border-t border-neutral-100">
          <View className="flex-row-reverse items-center justify-center py-4">
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text className="text-green-600 font-heebo font-medium mr-2">
              הצבעתכם נקלטה בהצלחה
            </Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}
