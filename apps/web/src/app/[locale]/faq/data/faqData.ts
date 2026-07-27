export type FAQCategory =
  | 'general'
  | 'voting'
  | 'security'
  | 'legal'
  | 'account';

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: FAQCategory;
}

export const faqData: FAQItem[] = [
  {
    id: 'what-is-taru',
    question: 'מה זה תַּרְאוּ?',
    answer:
      'פלטפורמה להצבעות מקומיות שמציגה תמונת מצב מאומתת של עמדת התושבים בנושאים שחשובים לשכונה — בצורה שקופה ובלתי ניתנת לזיוף.',
    category: 'general',
  },
  {
    id: 'is-it-real',
    question: 'זה באמת קורה, או רק רעיון?',
    answer:
      'זה קורה. ההצבעה הראשונה יוצאת לדרך ב-23.01.26 בפיילוט בקריית טבעון. אפשר להצטרף עכשיו, בחינם ובלי התחייבות, ולהיות בין הראשונים.',
    category: 'general',
  },
  {
    id: 'first-municipality',
    question: 'מה הרשות הראשונה בפיילוט?',
    answer: 'קריית טבעון. משם נרחיב לרשויות נוספות בהדרגה.',
    category: 'general',
  },
  {
    id: 'who-can-vote',
    question: 'מי יכול להצביע?',
    answer:
      'תושבים שנמצאים בתוך גבולות הרשות הרלוונטית בעת ההצבעה. כל קול שייך לתושב אחד אמיתי.',
    category: 'voting',
  },
  {
    id: 'view-results',
    question: 'אפשר לראות תוצאות?',
    answer: 'כן. כל התוצאות פתוחות וגלויות בעמוד ההצבעות הפומביות, בזמן אמת.',
    category: 'voting',
  },
  {
    id: 'next-vote',
    question: 'מתי ההצבעה הבאה?',
    answer: 'ההצבעה הראשונה ב-23.01.26. אחריה נפרסם לוח הצבעות מתעדכן.',
    category: 'voting',
  },
  {
    id: 'is-voting-free',
    question: 'האם ההצבעה עולה כסף?',
    answer:
      'לא. ההשתתפות בהצבעה היא ללא עלות וללא מנוי. כדי להשתתף יש להשלים את תהליך האימות הנדרש במערכת.',
    category: 'voting',
  },
  {
    id: 'location-verification',
    question: 'למה צריך אימות מיקום (GPS)?',
    answer:
      'כדי לוודא שמי שמצביע על נושא מקומי באמת גר באזור — וכך לצמצם מניפולציות מבחוץ. זו בדיקה חד-פעמית ברגע ההצבעה בלבד. אנחנו לא עוקבים אחריכם ולא שומרים מסלולי תנועה.',
    category: 'security',
  },
  {
    id: 'blockchain',
    question: 'מה הקשר לבלוקצ\'יין? זה מסבך?',
    answer:
      'הבלוקצ\'יין עובד מאחורי הקלעים ועושה דבר אחד פשוט: מקבע את ההצבעות כך שאי אפשר לשנות או לזייף אותן בדיעבד. אתם פשוט מצביעים — כל השאר קורה ברקע.',
    category: 'security',
  },
  {
    id: 'legal-binding',
    question: 'האם זה מחייב את המועצה משפטית? היא תקשיב?',
    answer:
      'תַּרְאוּ לא מחליף את המועצה ולא מחייב אותה משפטית. הוא מייצר תמונת מצב מקומית אחת, מאומתת וברורה, שקשה להתעלם ממנה — וכך מחזק יד אזרחית ושיח מסודר מול נבחרי הציבור.',
    category: 'legal',
  },
  {
    id: 'unsubscribe',
    question: 'איך מסירים הרשמה לעדכונים?',
    answer: 'בכל אימייל שאנחנו שולחים יש קישור הסרה בתחתית. לחיצה אחת ויצאתם.',
    category: 'account',
  },
];

export const faqCategories: Record<FAQCategory, string> = {
  general: 'כללי',
  voting: 'הצבעות',
  security: 'אבטחה ופרטיות',
  legal: 'משפטי',
  account: 'חשבון',
};

/** Display order for grouped category sections. */
export const faqCategoryOrder: FAQCategory[] = [
  'general',
  'voting',
  'security',
  'legal',
  'account',
];
