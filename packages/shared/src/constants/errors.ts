/**
 * Hebrew Error Messages
 *
 * Centralized error messages for the Sync platform
 * All user-facing errors should use these constants
 */

export const ErrorMessages = {
  // Authentication Errors
  AUTH_UNAUTHORIZED: 'אינך מחובר. אנא התחבר כדי להמשיך.',
  AUTH_SESSION_EXPIRED: 'הסשן פג תוקף. אנא התחבר מחדש.',
  AUTH_INVALID_TOKEN: 'טוקן לא תקין.',
  AUTH_GOOGLE_FAILED: 'ההתחברות עם Google נכשלה. אנא נסה שוב.',
  AUTH_FACEBOOK_FAILED: 'החיבור עם Facebook נכשל. אנא נסה שוב.',
  AUTH_INSTAGRAM_FAILED: 'החיבור עם Instagram נכשל. אנא נסה שוב.',

  // User Errors
  USER_NOT_FOUND: 'המשתמש לא נמצא.',
  USER_PROFILE_UPDATE_FAILED: 'לא ניתן לעדכן את הפרופיל. אנא נסה שוב.',
  USER_MUNICIPALITY_REQUIRED: 'אנא בחר עירייה לפני שתמשיך.',

  // Identity Score Errors
  IDENTITY_SCORE_LOW: 'ציון הזהות שלך נמוך מדי. נדרש מינימום 40 נקודות להצבעה.',
  IDENTITY_GOOGLE_REQUIRED: 'נדרשת התחברות עם Google.',

  // Verification Errors
  VERIFICATION_NOT_STARTED: 'תהליך האימות טרם התחיל.',
  VERIFICATION_ALREADY_STARTED: 'תהליך האימות כבר החל.',
  VERIFICATION_ALREADY_COMPLETED: 'האימות כבר הושלם.',
  VERIFICATION_FAILED: 'האימות נכשל. ניתן להתחיל מחדש.',
  VERIFICATION_REQUIRED: 'נדרש להשלים אימות מגורים לפני הצבעה.',
  VERIFICATION_LOCATION_OUTSIDE: 'המיקום שלך מחוץ לגבולות העירייה.',
  VERIFICATION_GPS_ACCURACY_LOW: 'דיוק ה-GPS נמוך מדי. נסה באזור פתוח.',
  VERIFICATION_WINDOW_CLOSED: 'חלון הצ\'ק-אין נסגר.',
  VERIFICATION_MUNICIPALITY_INVALID: 'העירייה שנבחרה לא תקינה.',

  // Vote Errors
  VOTE_NOT_FOUND: 'ההצבעה לא נמצאה.',
  VOTE_ALREADY_PARTICIPATED: 'כבר השתתפת בהצבעה זו.',
  VOTE_ENDED: 'ההצבעה הסתיימה.',
  VOTE_NOT_ACTIVE: 'ההצבעה לא פעילה.',
  VOTE_CREATION_FAILED: 'לא ניתן ליצור את ההצבעה. אנא נסה שוב.',
  VOTE_INVALID_OPTION: 'האפשרות שנבחרה לא תקינה.',
  VOTE_MUNICIPALITY_MISMATCH: 'ניתן להצביע רק בהצבעות של העירייה שלך.',

  // Payment Errors
  PAYMENT_FAILED: 'התשלום נכשל. אנא נסה שוב.',
  PAYMENT_CANCELLED: 'התשלום בוטל.',
  PAYMENT_INVALID_TYPE: 'סוג תשלום לא תקין.',
  PAYMENT_CREATION_FAILED: 'לא ניתן ליצור את התשלום. אנא נסה שוב.',
  PAYMENT_NOT_FOUND: 'התשלום לא נמצא.',
  PAYMENT_INSUFFICIENT_TOKENS: 'אין מספיק טוקנים.',

  // Social Proof Errors
  SOCIAL_DISCONNECT_FAILED: 'לא ניתן לנתק את החשבון. אנא נסה שוב.',
  SOCIAL_CONNECT_FAILED: 'לא ניתן לחבר את החשבון. אנא נסה שוב.',
  SOCIAL_GOOGLE_REQUIRED: 'לא ניתן לנתק את Google. הוא נדרש להתחברות.',
  SOCIAL_INVALID_PLATFORM: 'פלטפורמה לא תקינה.',

  // General Errors
  GENERAL_ERROR: 'אירעה שגיאה. אנא נסה שוב.',
  NETWORK_ERROR: 'שגיאת תקשורת. בדוק את החיבור לאינטרנט.',
  SERVER_ERROR: 'שגיאת שרת. אנא נסה שוב מאוחר יותר.',
  INVALID_REQUEST: 'בקשה לא תקינה.',
  NOT_FOUND: 'הדף לא נמצא.',
  FORBIDDEN: 'אין לך הרשאה לבצע פעולה זו.',

  // Location Errors
  LOCATION_PERMISSION_DENIED: 'נדרשת הרשאת מיקום לביצוע צ\'ק-אין.',
  LOCATION_UNAVAILABLE: 'לא ניתן לקבל את המיקום. אנא נסה שוב.',
  LOCATION_TIMEOUT: 'קבלת המיקום נמשכה יותר מדי זמן. אנא נסה שוב.',
} as const;

export type ErrorMessageKey = keyof typeof ErrorMessages;

/**
 * Get error message by key with fallback
 */
export function getErrorMessage(
  key: ErrorMessageKey | string,
  fallback?: string
): string {
  if (key in ErrorMessages) {
    return ErrorMessages[key as ErrorMessageKey];
  }
  return fallback || ErrorMessages.GENERAL_ERROR;
}

/**
 * Map HTTP status codes to error messages
 */
export function getErrorMessageFromStatus(status: number): string {
  switch (status) {
    case 400:
      return ErrorMessages.INVALID_REQUEST;
    case 401:
      return ErrorMessages.AUTH_UNAUTHORIZED;
    case 403:
      return ErrorMessages.FORBIDDEN;
    case 404:
      return ErrorMessages.NOT_FOUND;
    case 500:
    default:
      return ErrorMessages.SERVER_ERROR;
  }
}

/**
 * Success Messages (Hebrew)
 */
export const SuccessMessages = {
  // Auth
  AUTH_LOGIN_SUCCESS: 'התחברת בהצלחה!',
  AUTH_LOGOUT_SUCCESS: 'התנתקת בהצלחה.',
  AUTH_SIGNUP_SUCCESS: 'החשבון נוצר בהצלחה!',

  // Profile
  PROFILE_UPDATED: 'הפרופיל עודכן בהצלחה.',
  MUNICIPALITY_UPDATED: 'העירייה עודכנה בהצלחה.',

  // Social
  SOCIAL_FACEBOOK_CONNECTED: 'Facebook חובר בהצלחה!',
  SOCIAL_INSTAGRAM_CONNECTED: 'Instagram חובר בהצלחה!',
  SOCIAL_DISCONNECTED: 'החשבון נותק בהצלחה.',

  // Verification
  VERIFICATION_STARTED: 'תהליך האימות החל!',
  VERIFICATION_CHECKIN_SUCCESS: 'הצ\'ק-אין הושלם בהצלחה!',
  VERIFICATION_COMPLETED: 'האימות הושלם בהצלחה!',

  // Vote
  VOTE_CREATED: 'ההצבעה נוצרה בהצלחה!',
  VOTE_SUBMITTED: 'ההצבעה נרשמה בהצלחה!',

  // Payment
  PAYMENT_SUCCESS: 'התשלום הושלם בהצלחה!',
  TOKENS_RECEIVED: 'הטוקנים נוספו לחשבונך.',
} as const;

export type SuccessMessageKey = keyof typeof SuccessMessages;
