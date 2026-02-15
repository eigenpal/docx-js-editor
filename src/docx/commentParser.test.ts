/**
 * Unit tests for commentParser
 *
 * Tests parsing of comments.xml and cross-referencing with
 * commentsExtensible.xml for UTC timestamps.
 */

import { describe, test, expect } from 'bun:test';
import { parseComments } from './commentParser';

// Minimal comments.xml with two comments
const COMMENTS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">
  <w:comment w:id="1" w:author="Alice" w:initials="A" w:date="2024-02-10T15:30:00" w14:paraId="1A2B3C4D">
    <w:p>
      <w:r>
        <w:t>First comment</w:t>
      </w:r>
    </w:p>
  </w:comment>
  <w:comment w:id="2" w:author="Bob" w:initials="B" w:date="2024-03-05T09:15:00" w14:paraId="5E6F7A8B">
    <w:p>
      <w:r>
        <w:t>Second comment</w:t>
      </w:r>
    </w:p>
  </w:comment>
</w:comments>`;

// commentsExtensible.xml with UTC timestamps for the same comments
const COMMENTS_EXTENSIBLE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w16cex:commentsExtensible xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex">
  <w16cex:comment w16cex:paraId="1A2B3C4D" w16cex:dateUtc="2024-02-10T14:30:00Z"/>
  <w16cex:comment w16cex:paraId="5E6F7A8B" w16cex:dateUtc="2024-03-05T08:15:00Z"/>
</w16cex:commentsExtensible>`;

// Only has UTC for one of the two comments
const PARTIAL_EXTENSIBLE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w16cex:commentsExtensible xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex">
  <w16cex:comment w16cex:paraId="1A2B3C4D" w16cex:dateUtc="2024-02-10T14:30:00Z"/>
</w16cex:commentsExtensible>`;

// Comment with no date at all
const COMMENTS_NO_DATE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:comment w:id="1" w:author="Charlie">
    <w:p>
      <w:r>
        <w:t>Dateless comment</w:t>
      </w:r>
    </w:p>
  </w:comment>
</w:comments>`;

const emptyStyles = null;
const emptyTheme = null;
const emptyRels = new Map();
const emptyMedia = new Map();

describe('commentParser', () => {
  describe('basic parsing without commentsExtensible', () => {
    test('returns empty array for null input', () => {
      const result = parseComments(null, emptyStyles, emptyTheme, emptyRels, emptyMedia);
      expect(result).toEqual([]);
    });

    test('parses comments with local dates', () => {
      const comments = parseComments(COMMENTS_XML, emptyStyles, emptyTheme, emptyRels, emptyMedia);

      expect(comments).toHaveLength(2);

      expect(comments[0].id).toBe(1);
      expect(comments[0].author).toBe('Alice');
      expect(comments[0].initials).toBe('A');
      expect(comments[0].date).toBe('2024-02-10T15:30:00');

      expect(comments[1].id).toBe(2);
      expect(comments[1].author).toBe('Bob');
      expect(comments[1].initials).toBe('B');
      expect(comments[1].date).toBe('2024-03-05T09:15:00');
    });

    test('parses comment content as paragraphs', () => {
      const comments = parseComments(COMMENTS_XML, emptyStyles, emptyTheme, emptyRels, emptyMedia);

      expect(comments[0].content).toHaveLength(1);
      // Paragraph should contain content with a text run
      expect(comments[0].content[0].content).toBeDefined();
      expect(comments[0].content[0].content.length).toBeGreaterThan(0);
    });

    test('handles comments with no date', () => {
      const comments = parseComments(
        COMMENTS_NO_DATE_XML,
        emptyStyles,
        emptyTheme,
        emptyRels,
        emptyMedia
      );

      expect(comments).toHaveLength(1);
      expect(comments[0].author).toBe('Charlie');
      expect(comments[0].date).toBeUndefined();
    });
  });

  describe('UTC timestamp cross-referencing', () => {
    test('prefers UTC dates from commentsExtensible.xml', () => {
      const comments = parseComments(
        COMMENTS_XML,
        emptyStyles,
        emptyTheme,
        emptyRels,
        emptyMedia,
        COMMENTS_EXTENSIBLE_XML
      );

      expect(comments).toHaveLength(2);

      // UTC timestamps should be used instead of local dates
      expect(comments[0].date).toBe('2024-02-10T14:30:00Z');
      expect(comments[1].date).toBe('2024-03-05T08:15:00Z');
    });

    test('falls back to local date when UTC not available for a comment', () => {
      const comments = parseComments(
        COMMENTS_XML,
        emptyStyles,
        emptyTheme,
        emptyRels,
        emptyMedia,
        PARTIAL_EXTENSIBLE_XML
      );

      expect(comments).toHaveLength(2);

      // First comment has UTC match
      expect(comments[0].date).toBe('2024-02-10T14:30:00Z');
      // Second comment falls back to local date (no match in extensible)
      expect(comments[1].date).toBe('2024-03-05T09:15:00');
    });

    test('handles null commentsExtensible gracefully', () => {
      const comments = parseComments(
        COMMENTS_XML,
        emptyStyles,
        emptyTheme,
        emptyRels,
        emptyMedia,
        null
      );

      expect(comments).toHaveLength(2);
      // Should use local dates
      expect(comments[0].date).toBe('2024-02-10T15:30:00');
      expect(comments[1].date).toBe('2024-03-05T09:15:00');
    });

    test('handles empty commentsExtensible.xml', () => {
      const emptyExtensible = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w16cex:commentsExtensible xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex">
</w16cex:commentsExtensible>`;

      const comments = parseComments(
        COMMENTS_XML,
        emptyStyles,
        emptyTheme,
        emptyRels,
        emptyMedia,
        emptyExtensible
      );

      expect(comments).toHaveLength(2);
      expect(comments[0].date).toBe('2024-02-10T15:30:00');
    });

    test('paraId matching is case-insensitive', () => {
      // commentsExtensible uses lowercase paraId
      const lowerCaseExtensible = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w16cex:commentsExtensible xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex">
  <w16cex:comment w16cex:paraId="1a2b3c4d" w16cex:dateUtc="2024-02-10T14:30:00Z"/>
</w16cex:commentsExtensible>`;

      const comments = parseComments(
        COMMENTS_XML,
        emptyStyles,
        emptyTheme,
        emptyRels,
        emptyMedia,
        lowerCaseExtensible
      );

      // Should still match despite case difference
      expect(comments[0].date).toBe('2024-02-10T14:30:00Z');
    });
  });
});
