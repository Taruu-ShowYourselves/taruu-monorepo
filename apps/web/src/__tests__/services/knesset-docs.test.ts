import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  pickDocument,
  extractDocxText,
  normalizeDocUrl,
} from '@/services/knesset/docs';
import type { KnsDocument } from '@/services/knesset/odata';

function doc(partial: Partial<KnsDocument>): KnsDocument {
  return {
    GroupTypeID: null,
    GroupTypeDesc: null,
    ApplicationDesc: null,
    FilePath: null,
    LastUpdatedDate: null,
    ...partial,
  };
}

describe('pickDocument', () => {
  it('returns nulls when nothing is attached', () => {
    expect(pickDocument([])).toEqual({ extractable: null, linkable: null });
    expect(pickDocument([doc({ FilePath: '  ' })])).toEqual({
      extractable: null,
      linkable: null,
    });
  });

  it('prefers the docx of the highest-priority group', () => {
    const background = doc({
      GroupTypeID: 59,
      GroupTypeDesc: 'חומר רקע',
      FilePath: 'https://fs.knesset.gov.il/x/bk.docx',
    });
    const finalText = doc({
      GroupTypeID: 8,
      GroupTypeDesc: 'חוק - נוסח לא רשמי',
      FilePath: 'https://fs.knesset.gov.il/x/final.docx',
    });
    const { extractable, linkable } = pickDocument([background, finalText]);
    expect(extractable?.FilePath).toBe('https://fs.knesset.gov.il/x/final.docx');
    expect(linkable).toBe(extractable);
  });

  it('falls back to the best-ranked PDF as linkable when no docx exists', () => {
    const firstReadingPdf = doc({
      GroupTypeID: 2,
      GroupTypeDesc: 'הצעת חוק לקריאה הראשונה',
      FilePath: 'https://fs.knesset.gov.il/x/ls1.pdf',
    });
    const backgroundPdf = doc({
      GroupTypeID: 59,
      FilePath: 'https://fs.knesset.gov.il/x/bk.pdf',
    });
    const { extractable, linkable } = pickDocument([backgroundPdf, firstReadingPdf]);
    expect(extractable).toBeNull();
    expect(linkable?.FilePath).toBe('https://fs.knesset.gov.il/x/ls1.pdf');
  });
});

describe('extractDocxText', () => {
  it('unzips word/document.xml and strips markup into paragraphs', () => {
    const xml =
      '<?xml version="1.0"?><w:document><w:body>' +
      '<w:p><w:r><w:t>חוק זיכרון הטבח</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>סעיף 1: יום</w:t></w:r><w:r><w:t> הזיכרון</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const docx = zipSync({ 'word/document.xml': strToU8(xml) });
    expect(extractDocxText(docx)).toBe('חוק זיכרון הטבח\nסעיף 1: יום הזיכרון');
  });

  it('returns empty string when document.xml is missing', () => {
    const zip = zipSync({ 'nothing.txt': strToU8('x') });
    expect(extractDocxText(zip)).toBe('');
  });
});

describe('normalizeDocUrl', () => {
  it('converts upstream backslash separators to slashes', () => {
    expect(normalizeDocUrl('https://fs.knesset.gov.il/25\\agendasuggestion\\a.docx')).toBe(
      'https://fs.knesset.gov.il/25/agendasuggestion/a.docx'
    );
  });
});
