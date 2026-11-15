/** Where a sighting record comes from; drives the pin colour and the filter. */
export const UAP_SOURCES = Object.freeze([
  'fsr',
  'american-alchemy',
  'us-government',
]);

/** How well the place is known, best first. */
export const LOCATION_CONFIDENCES = Object.freeze(['high', 'medium', 'low']);

/**
 * Review states. `placeholder` marks hand-entered sample pins whose source
 * and citation have not been checked; `extracted` and `checked` are still in
 * review and never drawn.
 */
export const REVIEW_STATUSES = Object.freeze([
  'placeholder',
  'extracted',
  'checked',
  'published',
]);

const SHOWN_STATUSES = new Set(['placeholder', 'published']);
const MAX_SUMMARY_LENGTH = 400;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const text = (value, max = 200) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

/**
 * Read a date written as `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. The precision is
 * what the text states, so a case known only to the month never gains a day.
 * @param {unknown} value
 * @returns {{date: string, precision: 'day'|'month'|'year', year: number}|null}
 */
export function parseSightingDate(value) {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(
    typeof value === 'string' ? value : '',
  );
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  if (m !== undefined && (Number(m) < 1 || Number(m) > 12)) return null;
  if (d !== undefined) {
    const day = new Date(Date.UTC(year, Number(m) - 1, Number(d)));
    if (day.getUTCMonth() !== Number(m) - 1 || day.getUTCDate() !== Number(d))
      return null;
  }
  return {
    date: match[0],
    precision: d !== undefined ? 'day' : m !== undefined ? 'month' : 'year',
    year,
  };
}

/** Media is linked, never copied: a YouTube id and start second, or an https URL. */
function normalizeMedia(media) {
  if (!media || typeof media !== 'object') return null;
  if (typeof media.youtubeId === 'string' && YOUTUBE_ID.test(media.youtubeId)) {
    const start = Number(media.startSeconds);
    return {
      youtubeId: media.youtubeId,
      startSeconds: Number.isInteger(start) && start > 0 ? start : 0,
    };
  }
  if (typeof media.url === 'string') {
    try {
      const url = new URL(media.url);
      if (url.protocol === 'https:') return { url: url.href };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * One sighting in the shared model, or null when a required field is missing
 * or invalid. Every source is converted to this record.
 * @param {object} raw
 * @returns {object|null}
 */
export function normalizeSighting(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id, 80);
  const placeName = text(raw.placeName);
  const summary = text(raw.summary, MAX_SUMMARY_LENGTH);
  const when = parseSightingDate(raw.date);
  if (!id || !placeName || !summary || !when) return null;
  if (!UAP_SOURCES.includes(raw.source)) return null;
  if (!LOCATION_CONFIDENCES.includes(raw.locationConfidence)) return null;
  if (!REVIEW_STATUSES.includes(raw.reviewStatus)) return null;
  const { lat, lon } = raw;
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) return null;
  if (!Number.isFinite(lon) || Math.abs(lon) > 180) return null;
  return {
    id,
    source: raw.source,
    date: when.date,
    datePrecision: when.precision,
    year: when.year,
    placeName,
    lat,
    lon,
    locationConfidence: raw.locationConfidence,
    summary,
    citation: text(raw.citation),
    media: normalizeMedia(raw.media),
    reviewStatus: raw.reviewStatus,
  };
}

/** Whether a record may be drawn: nothing still in review goes on the map. */
export function isShowable(record) {
  return SHOWN_STATUSES.has(record?.reviewStatus);
}

/**
 * Valid, showable records with unique ids, in the order given.
 * @param {unknown} rows
 * @returns {object[]}
 */
export function normalizeSightings(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const record = normalizeSighting(row);
    if (!record || !isShowable(record) || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

/** The link a card opens: the video at its start second, or the linked file. */
export function mediaLink(record) {
  const media = record?.media;
  if (!media) return null;
  if (media.youtubeId)
    return `https://www.youtube.com/watch?v=${media.youtubeId}${
      media.startSeconds ? `&t=${media.startSeconds}s` : ''
    }`;
  return media.url || null;
}
