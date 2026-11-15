import test from 'node:test';
import assert from 'node:assert/strict';
import { csvRecords, parseCsv } from '../../../scripts/uap/csv.mjs';
import {
  buildGovRecords,
  dateFromTitle,
  documentId,
  leadingSentences,
  notASighting,
  officialLink,
  officialSummary,
  parseIncidentDate,
  splitSentences,
  spreadPoint,
} from '../../../scripts/uap/build-gov-records.mjs';
import { normalizeSighting } from './records.js';

test('CSV fields may hold commas, quotes and line breaks', () => {
  const text = '﻿Title,Note\r\n"A, B","say ""hi""\nthere"\r\n,\r\nC,D\n';
  assert.deepEqual(parseCsv(text)[1], ['A, B', 'say "hi"\nthere']);
  assert.deepEqual(csvRecords(text), [
    { Title: 'A, B', Note: 'say "hi"\nthere' },
    { Title: 'C', Note: 'D' },
  ]);
});

test('an incident date is read at the precision the index gives', () => {
  const cases = {
    '1/18/1957': ['1957-01-18', null],
    'June, 2026': ['2026-06', null],
    1958: ['1958', null],
    'Late 2025': ['2025', 'Late 2025'],
    '1952-1953': ['1952', '1952-1953'],
    'June 3-7, 1965': ['1965-06', 'June 3-7, 1965'],
    'March, April 2010': ['2010-03', 'March, April 2010'],
    '4/10/2025-4/11/2025': ['2025-04-10', '4/10/2025-4/11/2025'],
    '2002, 2023-2024': ['2002', '2002, 2023-2024'],
    '1970s': ['1970', '1970s'],
  };
  for (const [text, [date, stated]] of Object.entries(cases))
    assert.deepEqual(parseIncidentDate(text), { date, stated }, text);
  for (const none of ['N/A', '', 'Undated'])
    assert.equal(parseIncidentDate(none), null);
  assert.deepEqual(dateFromTitle('DOW-UAP-PR019, Report, Iraq, May 2022'), {
    date: '2022-05',
    stated: 'May 2022 (from the title)',
  });
  assert.equal(dateFromTitle('FBI Photo B1'), null);
});

test('document ids, non-sightings and links are recognised', () => {
  assert.equal(documentId('DOW-UAP-D155, Air Intelligence'), 'DOW-UAP-D155');
  assert.equal(documentId('CIA-UAP-012, Report'), 'CIA-UAP-012');
  assert.equal(documentId('DOW-UAP-PR46a, "Spherical UAP"'), 'DOW-UAP-PR46a');
  assert.equal(documentId('18_100754_ General 1946-7_Vol_2'), null);
  assert.equal(
    notASighting('DOW-UAP-D117, AAWSAP DIRD, Metallic Glasses'),
    'research paper',
  );
  assert.equal(notASighting('DOW-UAP-D177, Unresolved UAP Report'), null);
  assert.equal(
    officialLink({
      Type: 'PDF',
      'PDF | Image Link': 'https://www.war.gov/medialink/ufo/a.pdf',
      'DVIDS Video ID': '1',
    }),
    'https://www.war.gov/medialink/ufo/a.pdf',
  );
  assert.equal(
    officialLink({
      Type: 'VID',
      'PDF | Image Link': '',
      'DVIDS Video ID': '1006056',
    }),
    'https://www.dvidshub.net/video/1006056',
  );
  assert.equal(
    officialLink({ Type: 'PDF', 'PDF | Image Link': 'http://x.test/a.pdf' }),
    null,
  );
});

test('summaries keep whole sentences and skip the description of the form', () => {
  assert.deepEqual(splitSentences('The U.S. Air Force saw it. Dr. No left.'), [
    'The U.S. Air Force saw it.',
    'Dr. No left.',
  ]);
  assert.equal(
    leadingSentences('One two. Three four. Five six.', 20),
    'One two. Three four.',
  );
  assert.equal(leadingSentences('abcdefghij', 6), 'abcde…');
  const blurb =
    'This document is a report, a standardized U.S. Air Force reporting form.\n\n' +
    'This report records a 1957 incident over the desert.\n\n' +
    'Video description:\n\n00:00 a dot.';
  assert.equal(
    officialSummary(blurb, 'T'),
    'This report records a 1957 incident over the desert.',
  );
  assert.equal(
    officialSummary(
      'A standardized reporting form.',
      'DOW-UAP-D005, Mission Report',
    ),
    'Released file: DOW-UAP-D005, Mission Report.',
  );
});

test('pins that share a coarse place are fanned out, deterministically', () => {
  const place = { lat: 39, lon: -114, spread: 5 };
  assert.deepEqual(spreadPoint(place, 0, 1), { lat: 39, lon: -114 });
  const points = Array.from({ length: 20 }, (_, index) =>
    spreadPoint(place, index, 20),
  );
  assert.equal(
    new Set(points.map((point) => `${point.lat},${point.lon}`)).size,
    20,
  );
  assert.ok(points.every((point) => Math.abs(point.lat - 39) <= 5));
  assert.deepEqual(spreadPoint(place, 7, 20), points[7]);
});

const indexRow = (extra = {}) => ({
  'Release Date': '10/23/2026',
  Title: 'DOW-UAP-D900, Unresolved UAP Report, Iraq, 2023',
  Type: 'PDF',
  'Description Blurb': 'This report describes a light seen in 2023.',
  'DVIDS Video ID': '',
  Agency: 'Department of War',
  'Incident Date': '5/6/2023',
  'Incident Location': 'Iraq',
  'PDF | Image Link': 'https://www.war.gov/medialink/ufo/d900.pdf',
  ...extra,
});
const places = {
  Iraq: { placeName: 'Iraq', lat: 33, lon: 44, confidence: 'low', spread: 2 },
  Moon: null,
  '': null,
};

test('index rows become unreviewed records in the layer model', () => {
  const { records, skipped } = buildGovRecords(
    [
      indexRow(),
      indexRow({ Title: 'DOW-UAP-D901, Report, Iraq, 2023' }),
      indexRow({ Title: 'DOW-UAP-D902, Report', 'Incident Location': 'Moon' }),
      indexRow({ Title: 'DOW-UAP-D903, AAWSAP DIRD, Warp Drive' }),
      indexRow({ Title: 'DOW-UAP-D904, Report', 'Incident Date': 'N/A' }),
      indexRow({ Title: '18_100754_General_1946', 'Incident Location': '' }),
      indexRow({
        Title: 'DOW-UAP-D905, Report',
        'Incident Location': 'Atlantis',
      }),
    ],
    places,
    {},
  );
  assert.deepEqual(
    records.map((record) => record.id),
    ['gov-dow-uap-d900', 'gov-dow-uap-d901'],
  );
  assert.equal(skipped.length, 5);
  const [first, second] = records;
  assert.equal(first.reviewStatus, 'extracted');
  assert.equal(first.date, '2023-05-06');
  assert.equal(first.summaryBy, 'official');
  assert.equal(first.locationConfidence, 'low');
  assert.match(first.citation, /DOW-UAP-D900 · Department of War · war\.gov/);
  assert.notDeepEqual([first.lat, first.lon], [second.lat, second.lon]);
  for (const record of records)
    assert.ok(normalizeSighting(record), 'fits the layer model');
});

test('a reading of the PDF replaces the index date and place', () => {
  const { records, skipped } = buildGovRecords(
    [
      indexRow(),
      indexRow({ Title: 'DOW-UAP-D901, Report', 'Incident Location': 'Moon' }),
      indexRow({ Title: 'DOW-UAP-D902, Report' }),
    ],
    places,
    {
      'DOW-UAP-D900': [
        {
          date: '2023-05-07',
          placeName: 'A',
          lat: 1,
          lon: 2,
          locationConfidence: 'high',
          summary: 'Ours.',
        },
        {
          date: '2023-05-08',
          placeName: 'B',
          lat: 3,
          lon: 4,
          locationConfidence: 'medium',
          summary: 'Two.',
        },
      ],
      // Redacted in the PDF: the summary is ours, but nothing places it.
      'DOW-UAP-D901': [{ summary: 'Ours too.' }],
      'DOW-UAP-D902': [{ notSighting: 'A memo.' }],
    },
  );
  assert.deepEqual(
    records.map((record) => [
      record.id,
      record.date,
      record.lat,
      record.summaryBy,
    ]),
    [
      ['gov-dow-uap-d900', '2023-05-07', 1, 'ours'],
      ['gov-dow-uap-d900-2', '2023-05-08', 3, 'ours'],
    ],
  );
  assert.deepEqual(
    skipped.map((entry) => entry.reason),
    ['cannot be pinned: "Moon"', 'not a sighting: A memo.'],
  );
});
