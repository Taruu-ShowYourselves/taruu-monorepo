import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { buildSummaryPrompt, extractDocxText, normalizeDocUrl, pickDocument } from './docs.js';
import type { KnsDocument } from './knesset-odata.js';

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
    assert.deepEqual(pickDocument([]), { extractable: null, linkable: null });
    assert.deepEqual(pickDocument([doc({ FilePath: '  ' })]), {
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
    assert.equal(extractable?.FilePath, 'https://fs.knesset.gov.il/x/final.docx');
    assert.equal(linkable, extractable);
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
    assert.equal(extractable, null);
    assert.equal(linkable?.FilePath, 'https://fs.knesset.gov.il/x/ls1.pdf');
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
    assert.equal(extractDocxText(docx), 'חוק זיכרון הטבח\nסעיף 1: יום הזיכרון');
  });

  it('returns empty string when document.xml is missing', () => {
    const zip = zipSync({ 'nothing.txt': strToU8('x') });
    assert.equal(extractDocxText(zip), '');
  });
});

describe('normalizeDocUrl', () => {
  it('converts upstream backslash separators to slashes', () => {
    assert.equal(
      normalizeDocUrl('https://fs.knesset.gov.il/25\\agendasuggestion\\a.docx'),
      'https://fs.knesset.gov.il/25/agendasuggestion/a.docx'
    );
  });
});

describe('buildSummaryPrompt', () => {
  it('carries the title, group and document text', () => {
    const prompt = buildSummaryPrompt('חוק הנכים', 'חוק - נוסח לא רשמי', 'תוכן המסמך');
    assert.ok(prompt.includes('כותרת הסעיף: חוק הנכים'));
    assert.ok(prompt.includes('סוג המסמך: חוק - נוסח לא רשמי'));
    assert.ok(prompt.includes('תוכן המסמך'));
  });

  it('truncates oversized documents', () => {
    const prompt = buildSummaryPrompt('t', 'g', 'א'.repeat(50_000));
    assert.ok(prompt.length < 20_000);
  });
});
