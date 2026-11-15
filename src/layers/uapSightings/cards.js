import { formatDate, msg, t } from '../../i18n/index.js';
import { mediaLink } from './records.js';

export const SOURCE_LABELS = Object.freeze({
  fsr: msg('Flying Saucer Review'),
  'american-alchemy': msg('American Alchemy'),
  'us-government': msg('US government'),
});

export const SOURCE_COLORS = Object.freeze({
  fsr: '#f2b84b',
  'american-alchemy': '#c084fc',
  'us-government': '#4fc3f7',
});

export const CONFIDENCE_LABELS = Object.freeze({
  high: msg('Location: known site'),
  medium: msg('Location: approximate'),
  low: msg('Location: very approximate'),
});

/** The date as precisely as the record states it, and no more. */
export function formatSightingDate(record) {
  const [year, month = 1, day = 1] = record.date.split('-').map(Number);
  if (record.datePrecision === 'year') return String(year);
  return formatDate(Date.UTC(year, month - 1, day), {
    ...(record.datePrecision === 'day' ? { day: 'numeric' } : {}),
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const CARD_LINE_LENGTH = 72;

/** Break prose into lines of whole words, so a long summary stays on the card. */
export function wrapLines(text, width = CARD_LINE_LENGTH) {
  const lines = [];
  let line = '';
  for (const word of String(text || '')
    .split(/\s+/)
    .filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Title and detail lines for one sighting card. The card reports what
 * witnesses said and makes no claim about what the object was.
 * @param {object} record A normalized sighting record.
 * @returns {{title: string, details: string[], link: string|null}}
 */
export function describeSighting(record) {
  const details = [
    record.dateAsStated || formatSightingDate(record),
    ...wrapLines(record.summary),
  ];
  if (record.summaryBy === 'official')
    details.push(t('Summary: the releasing agency’s own description'));
  details.push(t(CONFIDENCE_LABELS[record.locationConfidence]));
  details.push(
    t('Source: {value}', { value: t(SOURCE_LABELS[record.source]) }),
  );
  if (record.citation)
    details.push(
      ...wrapLines(t('Citation: {value}', { value: record.citation })),
    );
  if (record.reviewStatus === 'placeholder')
    details.push(t('Sample pin: source and citation not yet checked'));
  else if (record.reviewStatus !== 'published')
    details.push(t('Not yet reviewed: built by machine from the release'));
  const link = mediaLink(record);
  if (link)
    details.push(
      record.media.youtubeId
        ? t('Click the card to open the video ↗')
        : t('Click the card to open the source ↗'),
    );
  return {
    title: `${t('UAP sighting')} · ${record.placeName}`,
    details,
    link,
  };
}
