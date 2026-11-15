import test from 'node:test';
import assert from 'node:assert/strict';
import { describeSighting, formatSightingDate, wrapLines } from './cards.js';
import { normalizeSighting } from './records.js';

const record = (extra = {}) =>
  normalizeSighting({
    id: 'a',
    source: 'fsr',
    date: '1967-09-04',
    placeName: 'Somewhere',
    lat: 52,
    lon: -3,
    locationConfidence: 'low',
    summary: 'A witness reported a light.',
    reviewStatus: 'published',
    ...extra,
  });

test('the date shows no more than the record states', () => {
  assert.equal(formatSightingDate(record({ date: '1967' })), '1967');
  const month = formatSightingDate(record({ date: '1967-09' }));
  assert.match(month, /1967/);
  assert.doesNotMatch(month, /\b1\b/);
  assert.match(formatSightingDate(record()), /\b4\b.*1967|1967.*\b4\b/);
});

test('a card gives the date, summary, confidence and source', () => {
  const { title, details, link } = describeSighting(
    record({ citation: 'Vol. 13, No. 4, p. 3' }),
  );
  assert.equal(title, 'UAP sighting · Somewhere');
  assert.equal(details[1], 'A witness reported a light.');
  assert.ok(details.includes('Location: very approximate'));
  assert.ok(details.includes('Source: Flying Saucer Review'));
  assert.ok(details.includes('Citation: Vol. 13, No. 4, p. 3'));
  assert.ok(!details.some((line) => line.startsWith('Sample pin')));
  assert.equal(link, null);
});

test('a placeholder says so, and a video adds its link', () => {
  const { details, link } = describeSighting(
    record({
      reviewStatus: 'placeholder',
      media: { youtubeId: 'abcdefghijk', startSeconds: 30 },
    }),
  );
  assert.ok(
    details.includes('Sample pin: source and citation not yet checked'),
  );
  assert.equal(details.at(-1), 'Click the card to open the video ↗');
  assert.equal(link, 'https://www.youtube.com/watch?v=abcdefghijk&t=30s');
});

test('an unreviewed record with an official summary and a loose date says so', () => {
  const { details } = describeSighting(
    record({
      date: '1965-06',
      dateAsStated: 'June 3-7, 1965',
      summaryBy: 'official',
      reviewStatus: 'extracted',
    }),
  );
  assert.equal(details[0], 'June 3-7, 1965');
  assert.ok(
    details.includes('Summary: the releasing agency’s own description'),
  );
  assert.ok(
    details.includes('Not yet reviewed: built by machine from the release'),
  );
});

test('a long summary wraps onto several card lines of whole words', () => {
  const summary = Array.from({ length: 40 }, (_, index) => `word${index}`).join(
    ' ',
  );
  const lines = wrapLines(summary, 30);
  assert.ok(lines.length > 5);
  assert.ok(lines.every((line) => line.length <= 30));
  assert.equal(lines.join(' '), summary);
  const { details } = describeSighting(record({ summary }));
  assert.ok(details.length > 6);
  assert.deepEqual(wrapLines(''), []);
});

test('a record with a released video invites playing it', () => {
  const { details, link } = describeSighting(
    record({ media: { url: 'https://www.war.gov/a.pdf', dvidsId: '7' } }),
  );
  assert.equal(details.at(-1), 'Click the card to play the video');
  assert.equal(link, 'https://www.war.gov/a.pdf');
});
