// Builds the US government sighting records from war.gov's PURSUE index.
//
//   node scripts/uap/build-gov-records.mjs
//
// Reads data/uap/war-gov/uap-data.csv (the index war.gov publishes, one row
// per released file), places.json (where each 'Incident Location' is pinned)
// and document-readings.json (facts read from the PDFs themselves), and writes
// src/layers/uapSightings/govRecords.json plus a build report beside the data.
//
// Every record is written as `extracted`: built by machine, not yet reviewed.
// Media is linked on war.gov or DVIDS, never copied.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvRecords } from './csv.mjs';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const DATA_DIR = path.join(ROOT, 'data/uap/war-gov');
const OUTPUT = path.join(ROOT, 'src/layers/uapSightings/govRecords.json');
const REPORT = path.join(DATA_DIR, 'build-report.json');

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const MONTH_PATTERN = MONTHS.join('|');
const pad = (value) => String(value).padStart(2, '0');
const MAX_SUMMARY = 380;

/**
 * Files that are not themselves a sighting report: research papers, programme
 * paperwork, correspondence, and drawings attached to a report that is listed
 * separately. Matched against the index title.
 */
const NOT_A_SIGHTING = [
  [/AAWSAP DIRD/i, 'research paper'],
  [
    /BAASS|Project Capella|Project Management Plan|Self-Assessment/i,
    'programme document',
  ],
  [/Personnel Record/i, 'personnel record'],
  [
    /Email Correspondence|Interagency|Briefing Notes|\bMemo\b/i,
    'correspondence',
  ],
  [/Digital Rendering|Composite Sketch/i, 'drawing attached to another report'],
];

/**
 * Read the index's 'Incident Date'. Returns the date at the precision the text
 * supports, plus `stated` (the text as written) whenever the text says more or
 * less than one plain date: a range, two dates, "Late 2025".
 * @param {string} text
 * @returns {{date: string, stated: string|null}|null}
 */
export function parseIncidentDate(text) {
  const value = String(text || '').trim();
  if (!value) return null;
  const day = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (day)
    return { date: `${day[3]}-${pad(day[1])}-${pad(day[2])}`, stated: null };
  const month = new RegExp(`^(${MONTH_PATTERN}),? (\\d{4})$`, 'i').exec(value);
  if (month)
    return {
      date: `${month[2]}-${pad(MONTHS.indexOf(month[1].toLowerCase()) + 1)}`,
      stated: null,
    };
  if (/^\d{4}$/.test(value)) return { date: value, stated: null };
  // Anything else is a range or a looser phrase: keep its start, at no more
  // precision than the text gives, and show the text itself on the card.
  const firstDay = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(value);
  if (firstDay)
    return {
      date: `${firstDay[3]}-${pad(firstDay[1])}-${pad(firstDay[2])}`,
      stated: value,
    };
  const year = /\b(1[89]\d{2}|20\d{2})/.exec(value);
  if (!year) return null;
  const named = new RegExp(`\\b(${MONTH_PATTERN})\\b`, 'i').exec(value);
  if (named && named.index < year.index)
    return {
      date: `${year[1]}-${pad(MONTHS.indexOf(named[1].toLowerCase()) + 1)}`,
      stated: value,
    };
  return { date: year[1], stated: value };
}

/** The date a title ends with ("…, May 2022"), for rows whose date is N/A. */
export function dateFromTitle(title) {
  const tail = String(title || '')
    .split(',')
    .pop()
    .trim();
  const parsed = parseIncidentDate(tail);
  return parsed
    ? { date: parsed.date, stated: `${tail} (from the title)` }
    : null;
}

/** The release's document id ("DOW-UAP-D155", "CIA-UAP-012", "DOW-UAP-PR46a"), or null. */
export function documentId(title) {
  const match = /^([A-Za-z]+-UAP-[A-Za-z]*\d+)([a-z]?)(?=[,_ ]|$)/.exec(
    String(title || '').trim(),
  );
  return match ? `${match[1].toUpperCase()}${match[2]}` : null;
}

/** An id for a row the release gave no document id: its title, slugged. */
export function titleSlug(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Sets of files released for one event under numbered titles. Only the first
 * that can be pinned is kept, so one event is not drawn dozens of times.
 */
const FILE_SERIES = [/^FBI Photo [A-Z]\d+/];

/** Why a title is not a sighting report, or null. */
export function notASighting(title) {
  for (const [pattern, reason] of NOT_A_SIGHTING)
    if (pattern.test(title)) return reason;
  return null;
}

const ABBREVIATION =
  /(?:\b(?:[A-Z]\.)+|\b[A-Z]\.|\b(?:Mr|Mrs|Ms|Dr|No|vs|approx|Gen|Col|Lt|Maj|Capt|Sgt|St|Jan|Feb|Mar|Apr|Aug|Sept|Sep|Oct|Nov|Dec)\.)$/;

/** Split prose into sentences without breaking at "U.S." or "Dr.". */
export function splitSentences(text) {
  const words = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ');
  const sentences = [];
  let current = [];
  for (const word of words) {
    current.push(word);
    const soFar = current.join(' ');
    if (
      /[.!?]["”’)\]]?$/.test(word) &&
      !ABBREVIATION.test(soFar.replace(/["”’)\]]$/, ''))
    ) {
      sentences.push(soFar);
      current = [];
    }
  }
  if (current.length) sentences.push(current.join(' '));
  return sentences.filter(Boolean);
}

/** Whole sentences from the start of `text`, within `max` characters. */
export function leadingSentences(text, max = MAX_SUMMARY) {
  const sentences = splitSentences(text);
  let out = '';
  for (const sentence of sentences) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length > max) break;
    out = next;
  }
  if (out) return out;
  const first = sentences[0] || '';
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}

/**
 * The part of the official description that says what was reported. Document
 * descriptions open with a paragraph about the form itself, so the first
 * paragraph that speaks of an incident wins.
 */
export function officialSummary(blurb, title = '') {
  // What follows 'Video description:' is a frame-by-frame account, not a summary.
  const paragraphs = String(blurb || '')
    .split(/\bVideo description:?/i)[0]
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part &&
        !/^Video description/i.test(part) &&
        !/provided for informational purposes only/i.test(part),
    );
  const sentences = splitSentences(paragraphs.join(' '));
  // Skip the sentences that explain what kind of form this is.
  const aboutTheForm = (sentence) =>
    /standardized|reporting form|primary vehicle|often use|defense-wide|GENTEXT|these reports/i.test(
      sentence,
    );
  const start = sentences.findIndex(
    (sentence) =>
      !aboutTheForm(sentence) &&
      /\b(describ|record|relay|report|observ|sighting|incident|depict|contain|submitted)/i.test(
        sentence,
      ),
  );
  const kept = (start > 0 ? sentences.slice(start) : sentences).filter(
    (sentence) => !aboutTheForm(sentence),
  );
  // A description that only explains the form says nothing about the event:
  // fall back to the file's official title.
  if (!kept.length) return leadingSentences(`Released file: ${title}.`);
  return leadingSentences(kept.join(' '));
}

/** Where the released file can be opened: war.gov for documents, DVIDS for video. */
export function officialLink(row) {
  const link = row['PDF | Image Link'];
  if (row.Type !== 'VID' && /^https:\/\/www\.war\.gov\//.test(link))
    return link;
  const dvids = row['DVIDS Video ID'];
  if (/^\d+$/.test(dvids)) return `https://www.dvidshub.net/video/${dvids}`;
  return /^https:\/\/www\.war\.gov\//.test(link) ? link : null;
}

const isoRelease = (text) => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  return match ? `${match[3]}-${pad(match[1])}-${pad(match[2])}` : text;
};

/**
 * Fan `count` pins out around a centre on a golden-angle spiral, so records
 * that share one coarse place can each be clicked. Deterministic.
 */
export function spreadPoint(place, index, count) {
  if (count <= 1 || !place.spread) return { lat: place.lat, lon: place.lon };
  const radius = place.spread * Math.sqrt((index + 0.5) / count);
  const angle = index * 2.399963229728653;
  const lat = place.lat + radius * Math.sin(angle);
  const stretch = Math.cos((place.lat * Math.PI) / 180) || 1;
  return {
    lat: Number(Math.max(-85, Math.min(85, lat)).toFixed(4)),
    lon: Number((place.lon + (radius * Math.cos(angle)) / stretch).toFixed(4)),
  };
}

/**
 * Turn index rows into sighting records.
 * @returns {{records: object[], skipped: {id: string, title: string, reason: string}[]}}
 */
export function buildGovRecords(rows, places, readings) {
  const drafts = [];
  const skipped = [];
  const used = new Map();
  const seriesKept = new Set();
  const uniqueId = (base) => {
    const seen = used.get(base) || 0;
    used.set(base, seen + 1);
    return seen ? `${base}-${seen + 1}` : base;
  };
  for (const row of rows) {
    const docId = documentId(row.Title);
    const label = docId || row.Title;
    const skip = (reason) =>
      skipped.push({ id: label, title: row.Title, reason });
    const read = (docId && readings[docId]) || [];
    if (read[0]?.notSighting) {
      skip(`not a sighting: ${read[0].notSighting}`);
      continue;
    }
    const excluded = notASighting(row.Title);
    if (excluded && !read.length) {
      skip(`not a sighting: ${excluded}`);
      continue;
    }
    if (!docId && /^\d+_/.test(row.Title)) {
      skip('archive volume; not yet read');
      continue;
    }
    const series = FILE_SERIES.find((pattern) => pattern.test(row.Title));
    const seriesKey = series && `${series}|${row['Incident Date']}`;
    if (seriesKey && seriesKept.has(seriesKey)) {
      skip('one of a set of files for the same event');
      continue;
    }
    const indexDate =
      parseIncidentDate(row['Incident Date']) || dateFromTitle(row.Title);
    const locationKey = row['Incident Location'];
    if (!(locationKey in places)) {
      skip(`place not in places.json: "${locationKey}"`);
      continue;
    }
    const place = places[locationKey];
    const release = isoRelease(row['Release Date']);
    const citation = `${docId || row.Title} · ${row.Agency} · war.gov PURSUE release of ${release}`;
    const link = officialLink(row);
    // The release's video, when it has one: played in the app from DVIDS.
    const dvidsId = /^\d+$/.test(row['DVIDS Video ID'])
      ? row['DVIDS Video ID']
      : null;
    const incidents = read.length ? read : [{}];
    for (const incident of incidents) {
      const placed = Number.isFinite(incident.lat);
      const date = incident.date || indexDate?.date;
      if (!date) {
        skip('no incident date in the index or the title');
        continue;
      }
      if (!placed && !place) {
        skip(
          locationKey
            ? `cannot be pinned: "${locationKey}"`
            : 'no incident location in the index',
        );
        continue;
      }
      if (seriesKey) seriesKept.add(seriesKey);
      drafts.push({
        placeKey: placed ? null : locationKey,
        record: {
          id: uniqueId(
            `gov-${docId ? docId.toLowerCase() : titleSlug(row.Title)}`,
          ),
          source: 'us-government',
          date,
          ...(incident.date || !indexDate?.stated
            ? {}
            : { dateAsStated: indexDate.stated }),
          placeName: placed ? incident.placeName : place.placeName,
          lat: placed ? incident.lat : place.lat,
          lon: placed ? incident.lon : place.lon,
          locationConfidence: placed
            ? incident.locationConfidence
            : place.confidence,
          summary: incident.summary
            ? leadingSentences(incident.summary)
            : officialSummary(row['Description Blurb'], row.Title),
          summaryBy: incident.summary ? 'ours' : 'official',
          citation,
          ...(link || dvidsId
            ? {
                media: {
                  ...(link ? { url: link } : {}),
                  ...(dvidsId ? { dvidsId } : {}),
                },
              }
            : {}),
          reviewStatus: 'extracted',
        },
      });
    }
  }
  // Records pinned from the index's coarse place share one point: fan them out.
  const groups = new Map();
  for (const draft of drafts) {
    if (!draft.placeKey) continue;
    const group = groups.get(draft.placeKey) || [];
    group.push(draft);
    groups.set(draft.placeKey, group);
  }
  for (const [key, group] of groups)
    group.forEach((draft, index) =>
      Object.assign(
        draft.record,
        spreadPoint(places[key], index, group.length),
      ),
    );
  // Readings that give the same point (several reports from one town or base)
  // would hide each other: fan those out a little too.
  const SAME_POINT_SPREAD = { high: 0.01, medium: 0.03, low: 0.15 };
  const stacks = new Map();
  for (const draft of drafts) {
    if (draft.placeKey) continue;
    const key = `${draft.record.lat},${draft.record.lon}`;
    const stack = stacks.get(key) || [];
    stack.push(draft.record);
    stacks.set(key, stack);
  }
  for (const stack of stacks.values()) {
    if (stack.length < 2) continue;
    const { lat, lon, locationConfidence } = stack[0];
    const spread = SAME_POINT_SPREAD[locationConfidence];
    stack.forEach((record, index) =>
      Object.assign(
        record,
        spreadPoint({ lat, lon, spread }, index, stack.length),
      ),
    );
  }
  return { records: drafts.map((draft) => draft.record), skipped };
}

function main() {
  const read = (name) => readFileSync(path.join(DATA_DIR, name), 'utf8');
  const strip = (object) =>
    Object.fromEntries(
      Object.entries(object).filter(([key]) => !key.startsWith('_')),
    );
  const csv = read('uap-data.csv');
  const rows = csvRecords(csv);
  const { records, skipped } = buildGovRecords(
    rows,
    strip(JSON.parse(read('places.json'))),
    strip(JSON.parse(read('document-readings.json'))),
  );
  const body = JSON.stringify(records);
  const version = `gov-${createHash('sha256').update(body).digest('hex').slice(0, 12)}`;
  writeFileSync(
    OUTPUT,
    `${JSON.stringify({ source: 'https://www.war.gov/UFO/', version, records }, null, 2)}\n`,
  );
  const reasons = {};
  for (const { reason } of skipped) {
    const key = reason.replace(/".*"/, '"…"');
    reasons[key] = (reasons[key] || 0) + 1;
  }
  writeFileSync(
    REPORT,
    `${JSON.stringify({ indexRows: rows.length, records: records.length, skipped: skipped.length, skippedByReason: reasons, skippedRows: skipped }, null, 2)}\n`,
  );
  console.log(
    `${rows.length} index rows → ${records.length} records, ${skipped.length} skipped`,
  );
  for (const [reason, count] of Object.entries(reasons).sort(
    (a, b) => b[1] - a[1],
  ))
    console.log(`  ${String(count).padStart(4)}  ${reason}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
