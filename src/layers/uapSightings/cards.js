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

/**
 * Title and detail lines for one sighting card. The card reports what
 * witnesses said and makes no claim about what the object was.
 * @param {object} record A normalized sighting record.
 * @returns {{title: string, details: string[], link: string|null}}
 */
export function describeSighting(record) {
  const details = [formatSightingDate(record), record.summary];
  details.push(t(CONFIDENCE_LABELS[record.locationConfidence]));
  details.push(
    t('Source: {value}', { value: t(SOURCE_LABELS[record.source]) }),
  );
  if (record.citation)
    details.push(t('Citation: {value}', { value: record.citation }));
  if (record.reviewStatus === 'placeholder')
    details.push(t('Sample pin: source and citation not yet checked'));
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
