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

/** English mirror of `faqData` — same ids and categories, translated copy. */
export const faqDataEn: FAQItem[] = [
  {
    id: 'what-is-taru',
    question: 'What is Taruu?',
    answer:
      'A platform for local votes that presents a verified picture of where residents stand on local issues, transparently and in a way that cannot be forged.',
    category: 'general',
  },
  {
    id: 'is-it-real',
    question: 'Is this really happening, or just an idea?',
    answer:
      'It is happening. The first vote launches on 04.08.26, nationwide at once. You can join now, free of charge and with no commitment, and be among the first.',
    category: 'general',
  },
  {
    id: 'first-municipality',
    question: 'Which municipalities does it operate in?',
    answer:
      'All of them. We are opening nationwide at once: every municipality in Israel, from day one.',
    category: 'general',
  },
  {
    id: 'who-can-vote',
    question: 'Who can vote?',
    answer:
      'Residents who are within the boundaries of the relevant municipality at the time of the vote. Every vote belongs to one real resident.',
    category: 'voting',
  },
  {
    id: 'view-results',
    question: 'Can I see the results?',
    answer:
      'Yes. All results are open and visible on the public votes page, in real time.',
    category: 'voting',
  },
  {
    id: 'next-vote',
    question: 'When is the next vote?',
    answer:
      'The first vote is on 04.08.26. After it, we will publish a regularly updated voting calendar.',
    category: 'voting',
  },
  {
    id: 'voting-cost',
    question: 'How much does it cost to vote?',
    answer:
      'Nothing. Participating in votes is free, with no payment and no barriers. Only identity and location verification are required, so that every vote is attributed to one real resident.',
    category: 'voting',
  },
  {
    id: 'where-money-goes',
    question: 'Where does the community fund’s money go?',
    answer:
      'The fund is filled by external investments in each vote’s BAG, not by residents’ money. It is managed in full transparency, under rules defined in advance, and every movement it makes is visible. The money goes back to the community, not to us.',
    category: 'payments',
  },
  {
    id: 'location-verification',
    question: 'Why is location verification (GPS) required?',
    answer:
      'To confirm that whoever votes on a local issue actually lives in the area, and so reduce manipulation from outside. It is a one-time check at the moment of voting only. We do not track you and we do not store movement histories.',
    category: 'security',
  },
  {
    id: 'blockchain',
    question: 'Where does blockchain come in? Does it complicate things?',
    answer:
      'The blockchain works behind the scenes and does one simple thing: it fixes the votes in place so they cannot be changed or forged after the fact. You simply vote, and everything else happens in the background.',
    category: 'security',
  },
  {
    id: 'legal-binding',
    question: 'Does this bind the council legally? Will it listen?',
    answer:
      'Taruu does not replace the council and does not bind it legally. It produces a single local picture, verified and clear, that is hard to ignore, and so strengthens the civic hand and an orderly dialogue with elected officials.',
    category: 'legal',
  },
  {
    id: 'unsubscribe',
    question: 'How do I unsubscribe from updates?',
    answer:
      'Every email we send has an unsubscribe link at the bottom. One click and you are out.',
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

/** English mirror of `faqCategories`. */
export const faqCategoriesEn: Record<FAQCategory, string> = {
  general: 'General',
  voting: 'Voting',
  security: 'Security and Privacy',
  payments: 'Money and Transparency',
  legal: 'Legal',
  account: 'Account',
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
