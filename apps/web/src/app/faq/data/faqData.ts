export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export const faqData: FAQItem[] = [
  {
    id: 'what-is-taru',
    question: 'מה זה תֵּרָאוּ?',
    answer: 'פלטפורמה להצבעות מקומיות שמציגה תמונת מצב של עמדת התושבים בצורה שקופה.',
    category: 'general',
  },
  {
    id: 'who-can-vote',
    question: 'מי יכול להצביע?',
    answer: 'תושבים שנמצאים בתוך גבולות הרשות הרלוונטית בעת ההצבעה.',
    category: 'voting',
  },
  {
    id: 'location-verification',
    question: 'למה צריך אימות מיקום?',
    answer: 'כדי לשמור שהצבעות יישארו מקומיות ולצמצם מניפולציות מבחוץ.',
    category: 'security',
  },
  {
    id: 'voting-cost',
    question: 'כמה עולה להצביע?',
    answer: '₪3 דמי השתתפות לכל הצבעה.',
    category: 'payments',
  },
  {
    id: 'where-money-goes',
    question: 'לאן הכסף הולך?',
    answer: 'לקרן קהילה שקופה שמיועדת לצעדים קהילתיים מוגדרים לפי כללים.',
    category: 'payments',
  },
  {
    id: 'legal-binding',
    question: 'האם זה מחייב את הרשות משפטית?',
    answer: 'לא בהכרח. המטרה היא לייצר תמונה מקומית ברורה שמחזקת פעולה אזרחית ושיח מסודר.',
    category: 'legal',
  },
  {
    id: 'view-results',
    question: 'אפשר לראות תוצאות?',
    answer: 'כן, בעמוד ההצבעות הפומביות.',
    category: 'voting',
  },
  {
    id: 'first-municipality',
    question: 'מה הרשות הראשונה בפיילוט?',
    answer: 'קריית טבעון.',
    category: 'general',
  },
  {
    id: 'next-vote',
    question: 'מתי ההצבעה הבאה?',
    answer: '23.01.26.',
    category: 'voting',
  },
  {
    id: 'unsubscribe',
    question: 'איך מסירים הרשמה לעדכונים?',
    answer: 'בכל אימייל יש קישור להסרה.',
    category: 'account',
  },
];

export const faqCategories = {
  general: 'כללי',
  voting: 'הצבעות',
  security: 'אבטחה',
  payments: 'תשלומים',
  legal: 'משפטי',
  account: 'חשבון',
};
