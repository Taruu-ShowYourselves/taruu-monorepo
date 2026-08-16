import type { Locale } from '@/lib/i18n';

/**
 * The four claims of the thesis - the argument of the whole paper, in order.
 *
 * One source, two renderers: the homepage prints them as four standing
 * sections (ThesisChapters), the pitch deck's intro still hands them off on
 * a scrub (CinematicIntro). Copy edited here changes both, which is the
 * point - the argument must not fork by surface.
 *
 * `*text*` marks emphasis; each renderer sets it in its own stress style.
 */
export interface ThesisBeat {
  head: string;
  note?: string;
}

export const THESIS_BEATS: Record<Locale, readonly ThesisBeat[]> = {
  he: [
    {
      head: 'אנחנו מאזינים לאזרחים בפייסבוק - בכל רשות, ובכנסת.',
      note: 'ופותחים להצבעה את הנושאים שראוי שיוכרעו בציבור.',
    },
    {
      head: 'סביב כל נושא נפתחת הצבעה אזרחית - והקולות נעשים *רוב אזרחי*.',
      note: 'רוב אזרחי הוא מנדט ציבורי: הוראה שהרשות או הממשלה נדרשת לכבד.',
    },
    { head: 'העירייה או הממשלה מקבלת ציון, וצוברת ניקוד לאורך הכהונה.' },
    {
      head: 'ואם היא לא מכבדת את המנדט - פונים לבית משפט.',
      note: 'רשות שמתעלמת מרצון התושבים מאבדת את הלגיטימציה שלה.',
    },
  ],
  en: [
    {
      head: 'We listen to citizens on Facebook - in every authority, and in the Knesset.',
      note: 'And open ballots on the topics that deserve a public decision.',
    },
    {
      head: 'Around each topic a civic ballot opens - and the votes become a *civilian majority*.',
      note: 'A civilian majority is a public mandate: an instruction the authority or the government is required to honour.',
    },
    {
      head: 'The municipality or the government is scored, and the score accrues across its term.',
    },
    {
      head: 'And if it does not honour the mandate - it is taken to court.',
      note: 'An authority that ignores the will of its residents loses its legitimacy.',
    },
  ],
};
