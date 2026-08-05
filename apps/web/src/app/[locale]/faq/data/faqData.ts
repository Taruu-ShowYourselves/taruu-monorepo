export type FAQCategory =
  | 'general'
  | 'voting'
  | 'security'
  | 'payments'
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
      'פלטפורמה להצבעות מקומיות שמציגה תמונת מצב מאומתת של עמדת התושבים בנושאים מקומיים, בצורה שקופה ובלתי ניתנת לזיוף.',
    category: 'general',
  },
  {
    id: 'is-it-real',
    question: 'זה באמת קורה, או רק רעיון?',
    answer:
      'זה קורה. ההצבעה הראשונה יוצאת לדרך ב-04.08.26, בכל הארץ בבת אחת. אפשר להצטרף עכשיו, בחינם ובלי התחייבות, ולהיות בין הראשונים.',
    category: 'general',
  },
  {
    id: 'first-municipality',
    question: 'באילו רשויות זה פועל?',
    answer: 'בכולן. אנחנו נפתחים בכל הארץ בבת אחת: כל רשות מקומית בישראל, מהיום הראשון.',
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
    answer: 'ההצבעה הראשונה ב-04.08.26. אחריה נפרסם לוח הצבעות מתעדכן.',
    category: 'voting',
  },
  {
    id: 'voting-cost',
    question: 'כמה עולה להצביע?',
    answer:
      'כלום. ההשתתפות בהצבעות חינם, בלי תשלום ובלי חסמים. נדרש רק אימות זהות ומיקום, כדי שכל קול ישויך לתושב אמיתי אחד.',
    category: 'voting',
  },
  {
    id: 'where-money-goes',
    question: 'לאן הולך הכסף של הקרן הקהילתית?',
    answer:
      'הקרן מתמלאת מהשקעות חיצוניות ב-BAG של כל הצבעה, לא מכסף של תושבים. היא מנוהלת בשקיפות מלאה, לפי כללים מוגדרים מראש, וכל תנועה שלה גלויה. הכסף חוזר לקהילה, לא אלינו.',
    category: 'payments',
  },
  {
    id: 'location-verification',
    question: 'למה צריך אימות מיקום (GPS)?',
    answer:
      'כדי לוודא שמי שמצביע על נושא מקומי באמת גר באזור, וכך לצמצם מניפולציות מבחוץ. זו בדיקה חד-פעמית ברגע ההצבעה בלבד. אנחנו לא עוקבים אחריכם ולא שומרים מסלולי תנועה.',
    category: 'security',
  },
  {
    id: 'blockchain',
    question: 'מה הקשר לבלוקצ\'יין? זה מסבך?',
    answer:
      'הבלוקצ\'יין עובד מאחורי הקלעים ועושה דבר אחד פשוט: מקבע את ההצבעות כך שאי אפשר לשנות או לזייף אותן בדיעבד. אתם פשוט מצביעים, וכל השאר קורה ברקע.',
    category: 'security',
  },
  {
    id: 'legal-binding',
    question: 'האם זה מחייב את המועצה משפטית? היא תקשיב?',
    answer:
      'תַּרְאוּ אינה מחליפה את המועצה ואינה מחייבת אותה משפטית. היא מייצרת תמונת מצב מקומית אחת, מאומתת וברורה, שקשה להתעלם ממנה, וכך מחזקת יד אזרחית ושיח מסודר מול נבחרי הציבור.',
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
  payments: 'כסף ושקיפות',
  legal: 'משפטי',
  account: 'חשבון',
};

/** Display order for grouped category sections. */
export const faqCategoryOrder: FAQCategory[] = [
  'general',
  'voting',
  'payments',
  'security',
  'legal',
  'account',
];
