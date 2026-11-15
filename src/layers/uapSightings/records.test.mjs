import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCATION_CONFIDENCES,
  UAP_SOURCES,
  mediaLink,
  normalizeSighting,
  normalizeSightings,
  parseSightingDate,
} from './records.js';
import { SAMPLE_SIGHTINGS } from './sampleRecords.js';
import { createUapSightingsSource } from './source.js';

const row = (extra = {}) => ({
  id: 'fsr-1967-v13-n4-03',
  source: 'fsr',
  date: '1967-09',
  placeName: 'Somewhere',
  lat: 52,
  lon: -3,
  locationConfidence: 'low',
  summary: 'A witness reported a light.',
  reviewStatus: 'published',
  ...extra,
});

test('a date keeps the precision it was written with', () => {
  assert.deepEqual(parseSightingDate('1967'), {
    date: '1967',
    precision: 'year',
    year: 1967,
  });
  assert.equal(parseSightingDate('1967-09').precision, 'month');
  assert.equal(parseSightingDate('1967-09-30').precision, 'day');
  for (const bad of ['1967-13', '1967-02-30', '67', '1967-9', '', null])
    assert.equal(parseSightingDate(bad), null, String(bad));
});

test('a record needs every required field to be valid', () => {
  const record = normalizeSighting(row());
  assert.equal(record.datePrecision, 'month');
  assert.equal(record.year, 1967);
  assert.equal(record.citation, null);
  assert.equal(record.media, null);
  for (const bad of [
    { id: '' },
    { source: 'nuforc' },
    { date: 'September 1967' },
    { placeName: ' ' },
    { lat: 91 },
    { lon: Number.NaN },
    { locationConfidence: 'exact' },
    { summary: null },
    { reviewStatus: 'draft' },
  ])
    assert.equal(normalizeSighting(row(bad)), null, JSON.stringify(bad));
});

test('only placeholder and published records reach the map, once each', () => {
  const records = normalizeSightings([
    row({ id: 'a' }),
    row({ id: 'a' }),
    row({ id: 'b', reviewStatus: 'extracted' }),
    row({ id: 'c', reviewStatus: 'checked' }),
    row({ id: 'd', reviewStatus: 'placeholder' }),
    row({ id: 'e', lat: 'north' }),
  ]);
  assert.deepEqual(
    records.map((record) => record.id),
    ['a', 'd'],
  );
  assert.deepEqual(normalizeSightings(null), []);
});

test('media is a link: a video at its start second, or an https file', () => {
  const video = normalizeSighting(
    row({ media: { youtubeId: 'abcdefghijk', startSeconds: 95 } }),
  );
  assert.equal(
    mediaLink(video),
    'https://www.youtube.com/watch?v=abcdefghijk&t=95s',
  );
  const file = normalizeSighting(
    row({ media: { url: 'https://example.gov/file.pdf' } }),
  );
  assert.equal(mediaLink(file), 'https://example.gov/file.pdf');
  for (const media of [
    { youtubeId: 'too-short' },
    { url: 'http://example.gov/file.pdf' },
    { url: 'javascript:alert(1)' },
    'https://example.gov',
  ])
    assert.equal(mediaLink(normalizeSighting(row({ media }))), null);
});

test('the sample pins are all valid placeholders covering the whole model', async () => {
  const { records, version } = await createUapSightingsSource().getSnapshot();
  assert.equal(records.length, SAMPLE_SIGHTINGS.length);
  assert.equal(typeof version, 'string');
  assert.ok(records.every((record) => record.reviewStatus === 'placeholder'));
  // No citation or media is claimed for a pin nobody has checked.
  assert.ok(records.every((record) => !record.citation && !record.media));
  const used = (key) => new Set(records.map((record) => record[key]));
  assert.deepEqual([...used('source')].sort(), [...UAP_SOURCES].sort());
  assert.deepEqual(
    [...used('locationConfidence')].sort(),
    [...LOCATION_CONFIDENCES].sort(),
  );
  assert.deepEqual([...used('datePrecision')].sort(), ['day', 'month', 'year']);
});
