/**
 * Expo Push Notification Service
 *
 * Handles sending push notifications to mobile devices via Expo's Push API.
 * Used for verification check-in reminders and other time-sensitive notifications.
 */

import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';

// Create Expo SDK client
const expo = new Expo();

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number; // Time to live in seconds
}

export interface SendNotificationResult {
  success: boolean;
  ticketId?: string;
  error?: string;
}

export interface BatchNotificationResult {
  sent: number;
  failed: number;
  tickets: ExpoPushTicket[];
  errors: string[];
}

/**
 * Validate if a push token is a valid Expo push token
 */
export function isValidExpoPushToken(token: string): boolean {
  return Expo.isExpoPushToken(token);
}

/**
 * Send a single push notification to a device
 */
export async function sendPushNotification(
  pushToken: string,
  payload: PushNotificationPayload
): Promise<SendNotificationResult> {
  // Validate the push token
  if (!isValidExpoPushToken(pushToken)) {
    return {
      success: false,
      error: 'Invalid Expo push token',
    };
  }

  const message: ExpoPushMessage = {
    to: pushToken,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: payload.sound || 'default',
    badge: payload.badge,
    channelId: payload.channelId || 'default',
    priority: payload.priority || 'high',
    ttl: payload.ttl,
  };

  try {
    const tickets = await expo.sendPushNotificationsAsync([message]);
    const ticket = tickets[0];

    if (ticket.status === 'ok') {
      return {
        success: true,
        ticketId: ticket.id,
      };
    } else {
      return {
        success: false,
        error: ticket.message || 'Unknown error',
      };
    }
  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return {
      success: false,
      error: error.message || 'Failed to send notification',
    };
  }
}

/**
 * Send push notifications to multiple devices
 */
export async function sendBatchNotifications(
  pushTokens: string[],
  payload: PushNotificationPayload
): Promise<BatchNotificationResult> {
  const result: BatchNotificationResult = {
    sent: 0,
    failed: 0,
    tickets: [],
    errors: [],
  };

  // Filter valid tokens
  const validTokens = pushTokens.filter((token) => {
    if (!isValidExpoPushToken(token)) {
      result.failed++;
      result.errors.push(`Invalid token: ${token.substring(0, 20)}...`);
      return false;
    }
    return true;
  });

  if (validTokens.length === 0) {
    return result;
  }

  // Create messages
  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: payload.sound || 'default',
    badge: payload.badge,
    channelId: payload.channelId || 'default',
    priority: payload.priority || 'high',
    ttl: payload.ttl,
  }));

  // Chunk messages to avoid rate limits (Expo recommends max 100 per batch)
  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      result.tickets.push(...tickets);

      for (const ticket of tickets) {
        if (ticket.status === 'ok') {
          result.sent++;
        } else {
          result.failed++;
          result.errors.push(ticket.message || 'Unknown error');
        }
      }
    } catch (error: any) {
      console.error('Error sending batch notifications:', error);
      result.failed += chunk.length;
      result.errors.push(error.message || 'Batch send failed');
    }
  }

  return result;
}

/**
 * Get receipts for sent notifications
 * Call this after some time to check delivery status
 */
export async function getNotificationReceipts(
  ticketIds: string[]
): Promise<Map<string, ExpoPushReceipt>> {
  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);
  const receipts = new Map<string, ExpoPushReceipt>();

  for (const chunk of receiptIdChunks) {
    try {
      const chunkReceipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const [id, receipt] of Object.entries(chunkReceipts)) {
        receipts.set(id, receipt);
      }
    } catch (error) {
      console.error('Error getting notification receipts:', error);
    }
  }

  return receipts;
}

// ============================================================================
// Verification-specific notification helpers
// ============================================================================

/**
 * Send check-in reminder notification
 */
export async function sendCheckInReminder(
  pushToken: string,
  checkInData: {
    scheduledTime: string;
    municipality: string;
    checkInNumber: number;
    totalCheckIns: number;
  }
): Promise<SendNotificationResult> {
  return sendPushNotification(pushToken, {
    title: '🔔 זמן לצ׳ק-אין!',
    body: `הגיע הזמן לאמת את המיקום שלכם ב${checkInData.municipality}. צ׳ק-אין ${checkInData.checkInNumber} מתוך ${checkInData.totalCheckIns}.`,
    data: {
      type: 'check_in_reminder',
      scheduledTime: checkInData.scheduledTime,
      municipality: checkInData.municipality,
      screen: '/verification/check-in',
    },
    channelId: 'verification',
    priority: 'high',
    ttl: 3600, // 1 hour
  });
}

/**
 * Send missed check-in notification
 */
export async function sendMissedCheckInNotification(
  pushToken: string,
  data: {
    missedCount: number;
    remainingAttempts: number;
    municipality: string;
  }
): Promise<SendNotificationResult> {
  return sendPushNotification(pushToken, {
    title: '⚠️ החמצתם צ׳ק-אין',
    body: data.remainingAttempts > 0
      ? `החמצתם צ׳ק-אין. נותרו לכם עוד ${data.remainingAttempts} הזדמנויות להשלמת האימות.`
      : 'החמצתם יותר מדי צ׳ק-אינים. האימות נכשל.',
    data: {
      type: 'missed_check_in',
      missedCount: data.missedCount,
      remainingAttempts: data.remainingAttempts,
      screen: '/verification',
    },
    channelId: 'verification',
    priority: 'high',
  });
}

/**
 * Send verification complete notification
 */
export async function sendVerificationCompleteNotification(
  pushToken: string,
  data: {
    municipality: string;
    totalCheckIns: number;
  }
): Promise<SendNotificationResult> {
  return sendPushNotification(pushToken, {
    title: '🎉 האימות הושלם!',
    body: `מזל טוב! אימות התושבות שלכם ב${data.municipality} הושלם בהצלחה. עכשיו אתם יכולים להצביע!`,
    data: {
      type: 'verification_complete',
      municipality: data.municipality,
      screen: '/verification/complete',
    },
    channelId: 'verification',
    priority: 'high',
  });
}

/**
 * Send verification failed notification
 */
export async function sendVerificationFailedNotification(
  pushToken: string,
  data: {
    reason: string;
    canRetry: boolean;
  }
): Promise<SendNotificationResult> {
  return sendPushNotification(pushToken, {
    title: '❌ האימות נכשל',
    body: data.canRetry
      ? `האימות נכשל: ${data.reason}. אתם יכולים לנסות שוב.`
      : `האימות נכשל: ${data.reason}.`,
    data: {
      type: 'verification_failed',
      reason: data.reason,
      canRetry: data.canRetry,
      screen: '/verification',
    },
    channelId: 'verification',
    priority: 'high',
  });
}

/**
 * Send upcoming check-in reminder (1 hour before)
 */
export async function sendUpcomingCheckInReminder(
  pushToken: string,
  data: {
    scheduledTime: string;
    municipality: string;
  }
): Promise<SendNotificationResult> {
  return sendPushNotification(pushToken, {
    title: '⏰ תזכורת: צ׳ק-אין בעוד שעה',
    body: `בעוד שעה יש לכם צ׳ק-אין מתוזמן ב${data.municipality}. הכינו את עצמכם!`,
    data: {
      type: 'upcoming_check_in',
      scheduledTime: data.scheduledTime,
      screen: '/verification',
    },
    channelId: 'verification',
    priority: 'default',
  });
}
