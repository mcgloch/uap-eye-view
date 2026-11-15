import { normalizeSightings } from './records.js';
import { SAMPLE_SIGHTINGS, SAMPLE_SIGHTINGS_VERSION } from './sampleRecords.js';
import govRecords from './govRecords.json' with { type: 'json' };

/**
 * The sightings bundled with the app: the hand-entered sample pins and the US
 * government records built from war.gov's index (scripts/uap/build-gov-records.mjs).
 * The FSR and video pipelines will write reviewed records here too.
 *
 * `preview` also returns records still awaiting review. It is on in the
 * development server only, so nothing unreviewed reaches a public build.
 */
export function createUapSightingsSource({
  rows = [...SAMPLE_SIGHTINGS, ...govRecords.records],
  version = `${SAMPLE_SIGHTINGS_VERSION}+${govRecords.version}`,
  preview = Boolean(import.meta.env?.DEV),
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      return {
        records: normalizeSightings(rows, { preview }),
        version: `${version}${preview ? '+preview' : ''}`,
      };
    },
  };
}
