import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { getAuthToken } from '@/lib/auth';
import { useUser } from '@/stores/authStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://sync.co.il';

interface PaymentDetails {
  id: string;
  orderId: string;
  paymentUrl: string;
  amount: number;
  currency: string;
  expiresAt: string;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    type: 'vote_participation' | 'vote_creation';
    voteId?: string;
    voteTitle?: string;
  }>();
  const user = useUser();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createPayment();
  }, []);

  const createPayment = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('אינך מחובר');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/payments/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: params.type,
          voteId: params.voteId,
          voteTitle: params.voteTitle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'לא ניתן ליצור תשלום');
        setLoading(false);
        return;
      }

      setPaymentDetails({
        id: data.payment.id,
        orderId: data.payment.orderId,
        paymentUrl: data.payment.paymentUrl,
        amount: data.payment.amount,
        currency: data.payment.currency,
        expiresAt: data.payment.expiresAt,
      });
      setLoading(false);
    } catch (err) {
      setError('שגיאה ביצירת תשלום');
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentDetails) return;

    setProcessing(true);

    try {
      // Open Green Invoice payment page in browser
      const result = await WebBrowser.openAuthSessionAsync(
        paymentDetails.paymentUrl,
        `${API_URL}/votes/${params.voteId || 'create'}/callback`
      );

      if (result.type === 'success') {
        // Payment completed, navigate to success
        router.replace({
          pathname: '/payment/success',
          params: {
            paymentId: paymentDetails.id,
            amount: String(paymentDetails.amount),
            type: params.type,
            voteId: params.voteId || '',
          },
        });
      } else if (result.type === 'cancel') {
        // User cancelled
        setProcessing(false);
      } else {
        // Check payment status
        await checkPaymentStatus();
      }
    } catch (err) {
      setProcessing(false);
      Alert.alert('שגיאה', 'התשלום נכשל. אנא נסו שוב.');
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentDetails) return;

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${API_URL}/api/payments/${paymentDetails.id}/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.succeeded) {
        router.replace({
          pathname: '/payment/success',
          params: {
            paymentId: paymentDetails.id,
            amount: String(paymentDetails.amount),
            type: params.type,
            voteId: params.voteId || '',
          },
        });
      } else {
        setProcessing(false);
        if (data.status === 'failed') {
          router.replace({
            pathname: '/payment/failed',
            params: {
              error: 'התשלום נכשל',
            },
          });
        }
      }
    } catch (err) {
      setProcessing(false);
    }
  };

  const getPaymentTitle = () => {
    return params.type === 'vote_participation'
      ? 'השתתפות בהצבעה'
      : 'יצירת הצבעה';
  };

  const getPaymentDescription = () => {
    if (params.type === 'vote_participation') {
      return params.voteTitle
        ? `תשלום להשתתפות בהצבעה: ${params.voteTitle}`
        : 'תשלום להשתתפות בהצבעה';
    }
    return 'תשלום ליצירת הצבעה חדשה בפלטפורמה';
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-3 text-neutral-500 font-assistant">מכין תשלום...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-red-100 items-center justify-center mb-4">
            <Ionicons name="close-circle" size={40} color="#DC2626" />
          </View>
          <Text className="text-xl font-heebo font-bold text-neutral-900 mb-2 text-center">
            שגיאה
          </Text>
          <Text className="text-base font-assistant text-neutral-500 text-center mb-6">
            {error}
          </Text>
          <Pressable
            className="bg-primary-600 px-8 py-3 rounded-xl active:bg-primary-700"
            onPress={() => router.back()}
          >
            <Text className="text-white font-heebo font-semibold">חזרה</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row-reverse items-center px-5 py-4 border-b border-neutral-100">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="close" size={24} color="#374151" />
        </Pressable>
        <Text className="flex-1 text-lg font-heebo font-semibold text-neutral-900 text-right mr-4">
          תשלום
        </Text>
      </View>

      <View className="flex-1 px-5 py-6">
        {/* Payment Info */}
        <View className="bg-neutral-50 rounded-2xl p-5 mb-6">
          <Text className="text-lg font-heebo font-semibold text-neutral-900 text-right mb-2">
            {getPaymentTitle()}
          </Text>
          <Text className="text-sm font-assistant text-neutral-500 text-right mb-4">
            {getPaymentDescription()}
          </Text>
          <View className="flex-row-reverse justify-between items-center border-t border-neutral-200 pt-4">
            <Text className="text-base font-assistant text-neutral-600">סכום לתשלום</Text>
            <Text className="text-2xl font-heebo font-bold text-primary-600">
              ₪{paymentDetails?.amount}
            </Text>
          </View>
        </View>

        {/* Token Info */}
        <View className="bg-primary-50 rounded-2xl p-5 mb-6">
          <View className="flex-row-reverse items-center mb-2">
            <Ionicons name="flash" size={20} color="#2563EB" />
            <Text className="flex-1 text-base font-heebo font-semibold text-primary-700 text-right mr-2">
              תקבלו טוקנים
            </Text>
          </View>
          <Text className="text-sm font-assistant text-primary-600 text-right">
            עם התשלום תקבלו {paymentDetails?.amount} טוקני SYNC (1 ש"ח = 1 טוקן)
          </Text>
        </View>

        {/* User Info */}
        <View className="bg-neutral-50 rounded-2xl p-5 mb-8">
          <Text className="text-sm font-assistant text-neutral-500 text-right mb-2">
            פרטי המשלם
          </Text>
          <View className="flex-row-reverse items-center">
            <View className="w-10 h-10 rounded-full bg-primary-100 items-center justify-center">
              <Text className="font-heebo font-bold text-primary-600">
                {user?.firstName?.[0] || user?.email?.[0] || '?'}
              </Text>
            </View>
            <View className="flex-1 mr-3">
              <Text className="text-base font-heebo text-neutral-900 text-right">
                {user?.firstName} {user?.lastName}
              </Text>
              <Text className="text-sm font-assistant text-neutral-500 text-right">
                {user?.email}
              </Text>
            </View>
          </View>
        </View>

        {/* Pay Button */}
        <Pressable
          className={`py-4 rounded-xl items-center ${
            processing ? 'bg-neutral-300' : 'bg-primary-600 active:bg-primary-700'
          }`}
          onPress={handlePayment}
          disabled={processing}
        >
          {processing ? (
            <View className="flex-row items-center">
              <ActivityIndicator color="white" />
              <Text className="text-white text-lg font-heebo font-semibold mr-2">
                מעבד תשלום...
              </Text>
            </View>
          ) : (
            <Text className="text-white text-lg font-heebo font-semibold">
              שלם ₪{paymentDetails?.amount}
            </Text>
          )}
        </Pressable>

        {/* Security Note */}
        <View className="flex-row-reverse items-center justify-center mt-4">
          <Ionicons name="lock-closed" size={14} color="#6B7280" />
          <Text className="text-xs font-assistant text-neutral-500 mr-1">
            תשלום מאובטח באמצעות Green Invoice
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
