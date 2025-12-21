import { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { votesApi, paymentsApi } from '@sync/api-client';
import { CREATE_VOTE_COST, formatCurrency } from '@sync/shared';
import * as WebBrowser from 'expo-web-browser';

export default function CreateVoteScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [duration, setDuration] = useState(7); // days

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const validateStep1 = () => {
    if (!title.trim()) {
      setError('יש להזין כותרת');
      return false;
    }
    if (title.length < 10) {
      setError('הכותרת חייבת להכיל לפחות 10 תווים');
      return false;
    }
    if (!description.trim()) {
      setError('יש להזין תיאור');
      return false;
    }
    if (description.length < 30) {
      setError('התיאור חייב להכיל לפחות 30 תווים');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep2 = () => {
    const filledOptions = options.filter((o) => o.trim());
    if (filledOptions.length < 2) {
      setError('יש להזין לפחות 2 אפשרויות');
      return false;
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError('');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // Create payment intent
      const paymentIntent = await paymentsApi.createPaymentIntent({
        amount: CREATE_VOTE_COST,
        type: 'create_vote',
        metadata: {
          title,
          description,
          options: options.filter((o) => o.trim()),
          duration,
        },
      });

      // Open payment page
      const result = await WebBrowser.openBrowserAsync(paymentIntent.paymentUrl);

      if (result.type === 'cancel') {
        Alert.alert('התשלום בוטל', 'ניתן לנסות שוב מאוחר יותר');
        return;
      }

      // After successful payment, the vote will be created via webhook
      Alert.alert(
        'ההצבעה נוצרה!',
        'ההצבעה שלכם תפורסם לאחר אישור התשלום',
        [{ text: 'אישור', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (err: any) {
      setError(err.message || 'שגיאה ביצירת ההצבעה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row-reverse items-center justify-between px-5 pt-4 pb-2">
        <View className="flex-1">
          <Text className="text-2xl font-heebo font-bold text-neutral-900 text-right">
            יצירת הצבעה
          </Text>
          <Text className="text-neutral-500 font-assistant text-right">
            שלב {step} מתוך 3
          </Text>
        </View>
        {step > 1 && (
          <Pressable onPress={handleBack} className="p-2">
            <Ionicons name="arrow-forward" size={24} color="#374151" />
          </Pressable>
        )}
      </View>

      {/* Progress bar */}
      <View className="px-5 py-2">
        <View className="h-1 bg-neutral-200 rounded-full">
          <Animated.View
            className="h-1 bg-primary-600 rounded-full"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {step === 1 && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Text className="text-lg font-heebo font-semibold text-neutral-900 text-right mt-4 mb-2">
              פרטי ההצבעה
            </Text>

            <Text className="text-sm font-assistant text-neutral-600 text-right mb-1">
              כותרת *
            </Text>
            <TextInput
              className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-right font-assistant mb-4"
              placeholder="למשל: הקמת גן שעשועים חדש"
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

            <Text className="text-sm font-assistant text-neutral-600 text-right mb-1">
              תיאור *
            </Text>
            <TextInput
              className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-right font-assistant mb-4"
              placeholder="תארו את הנושא בפירוט..."
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
              style={{ minHeight: 120 }}
            />
            <Text className="text-xs text-neutral-400 font-assistant text-right">
              {description.length}/500 תווים
            </Text>
          </Animated.View>
        )}

        {step === 2 && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Text className="text-lg font-heebo font-semibold text-neutral-900 text-right mt-4 mb-2">
              אפשרויות להצבעה
            </Text>
            <Text className="text-sm text-neutral-500 font-assistant text-right mb-4">
              הוסיפו 2-5 אפשרויות שהמצביעים יוכלו לבחור ביניהן
            </Text>

            {options.map((option, index) => (
              <View key={index} className="flex-row-reverse items-center mb-3">
                <View className="flex-1">
                  <TextInput
                    className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-right font-assistant"
                    placeholder={`אפשרות ${index + 1}`}
                    placeholderTextColor="#9CA3AF"
                    value={option}
                    onChangeText={(value) => updateOption(index, value)}
                    maxLength={100}
                  />
                </View>
                {options.length > 2 && (
                  <Pressable onPress={() => removeOption(index)} className="p-2 mr-2">
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </Pressable>
                )}
              </View>
            ))}

            {options.length < 5 && (
              <Pressable
                className="flex-row-reverse items-center justify-center py-3 border-2 border-dashed border-neutral-300 rounded-xl mt-2"
                onPress={addOption}
              >
                <Ionicons name="add" size={20} color="#2563EB" />
                <Text className="text-primary-600 font-heebo font-medium mr-2">
                  הוספת אפשרות
                </Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {step === 3 && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Text className="text-lg font-heebo font-semibold text-neutral-900 text-right mt-4 mb-4">
              סיכום ותשלום
            </Text>

            {/* Summary Card */}
            <View className="bg-neutral-50 rounded-2xl p-4 mb-4">
              <Text className="text-base font-heebo font-semibold text-neutral-900 text-right">
                {title}
              </Text>
              <Text className="text-sm text-neutral-600 font-assistant text-right mt-2">
                {description}
              </Text>
              <View className="border-t border-neutral-200 mt-4 pt-4">
                <Text className="text-sm font-heebo text-neutral-700 text-right mb-2">
                  אפשרויות:
                </Text>
                {options.filter((o) => o.trim()).map((option, index) => (
                  <View key={index} className="flex-row-reverse items-center mb-1">
                    <View className="w-2 h-2 bg-primary-600 rounded-full ml-2" />
                    <Text className="text-sm text-neutral-600 font-assistant">{option}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Duration Selection */}
            <Text className="text-sm font-assistant text-neutral-600 text-right mb-2">
              משך ההצבעה
            </Text>
            <View className="flex-row-reverse flex-wrap mb-4">
              {[3, 7, 14, 30].map((days) => (
                <Pressable
                  key={days}
                  className={`px-4 py-2 rounded-full ml-2 mb-2 ${
                    duration === days ? 'bg-primary-600' : 'bg-neutral-100'
                  }`}
                  onPress={() => setDuration(days)}
                >
                  <Text
                    className={`font-heebo text-sm ${
                      duration === days ? 'text-white font-medium' : 'text-neutral-600'
                    }`}
                  >
                    {days} ימים
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Payment Info */}
            <View className="bg-primary-50 rounded-2xl p-4 mb-4">
              <View className="flex-row-reverse justify-between items-center">
                <Text className="text-base font-heebo text-neutral-700">עלות יצירת הצבעה</Text>
                <Text className="text-2xl font-heebo font-bold text-primary-600">
                  {formatCurrency(CREATE_VOTE_COST)}
                </Text>
              </View>
              <Text className="text-xs text-neutral-500 font-assistant text-right mt-2">
                התשלום מאובטח דרך Green Invoice
              </Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Error */}
      {error ? (
        <Text className="text-red-500 text-center font-assistant px-5 mb-2">{error}</Text>
      ) : null}

      {/* Action Button */}
      <View className="px-5 pb-6">
        <Pressable
          className={`py-4 rounded-xl items-center ${
            loading ? 'bg-neutral-300' : 'bg-primary-600 active:bg-primary-700'
          }`}
          onPress={step < 3 ? handleNext : handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-lg font-heebo font-semibold">
              {step < 3 ? 'המשך' : `שלם ${formatCurrency(CREATE_VOTE_COST)} וצור הצבעה`}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
