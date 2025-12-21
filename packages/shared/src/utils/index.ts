/**
 * Shared Utilities
 */

/**
 * Format currency in ILS
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format number with Hebrew locale
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('he-IL').format(num);
}

/**
 * Format date in Hebrew
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Format date and time in Hebrew
 */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format relative time (e.g., "3 days ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMs < 0) {
    // Past
    if (diffDays < -1) return `לפני ${Math.abs(diffDays)} ימים`;
    if (diffDays === -1) return 'אתמול';
    if (diffHours < -1) return `לפני ${Math.abs(diffHours)} שעות`;
    if (diffMinutes < -1) return `לפני ${Math.abs(diffMinutes)} דקות`;
    return 'עכשיו';
  } else {
    // Future
    if (diffDays > 1) return `בעוד ${diffDays} ימים`;
    if (diffDays === 1) return 'מחר';
    if (diffHours > 1) return `בעוד ${diffHours} שעות`;
    if (diffMinutes > 1) return `בעוד ${diffMinutes} דקות`;
    return 'עכשיו';
  }
}

/**
 * Get time remaining until a date
 */
export function getTimeRemaining(endDate: Date): string {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();

  if (diff < 0) return 'הסתיימה';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days} ימים`;
  if (hours > 0) return `${hours} שעות`;
  if (minutes > 0) return `${minutes} דקות`;
  return 'פחות מדקה';
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate Israeli phone number
 */
export function isValidIsraeliPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  // Israeli phone: starts with 05, 10 digits total
  return /^05\d{8}$/.test(cleaned);
}

/**
 * Format Israeli phone number
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length !== 10) return phone;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}

/**
 * Hash GPS coordinates for privacy
 */
export function hashCoordinates(lat: number, lng: number): string {
  // Simple hash - in production use proper crypto
  const str = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
