import { normalizeSightings } from './records.js';
import { SAMPLE_SIGHTINGS, SAMPLE_SIGHTINGS_VERSION } from './sampleRecords.js';

/**
 * The sightings bundled with the app. Today these are the sample pins; the
 * FSR, video and government pipelines will write reviewed records here.
 */
export function createUapSightingsSource({
  rows = SAMPLE_SIGHTINGS,
  version = SAMPLE_SIGHTINGS_VERSION,
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      return { records: normalizeSightings(rows), version };
    },
  };
}
