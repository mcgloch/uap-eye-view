/**
 * Hand-entered sample pins that exercise the sighting model: every source,
 * every date precision and every location confidence.
 *
 * They are well-known public cases, summarized in our own words. They are
 * NOT taken from the project's sources: `source` only says which pipeline a
 * pin stands in for, no citation or media has been entered, and coordinates
 * are approximate. Replace them with reviewed records before publishing.
 */
export const SAMPLE_SIGHTINGS_VERSION = 'sample-1';

export const SAMPLE_SIGHTINGS = Object.freeze(
  [
    {
      id: 'sample-1947-mount-rainier',
      source: 'american-alchemy',
      date: '1947-06-24',
      placeName: 'Near Mount Rainier, Washington, USA',
      lat: 46.85,
      lon: -121.76,
      locationConfidence: 'medium',
      summary:
        'A private pilot reported nine bright objects flying in a line at high speed past the mountain.',
    },
    {
      id: 'sample-1947-roswell',
      source: 'american-alchemy',
      date: '1947-07',
      placeName: 'Ranchland north-west of Roswell, New Mexico, USA',
      lat: 33.95,
      lon: -105.31,
      locationConfidence: 'low',
      summary:
        'A rancher found scattered debris, and the local army air field briefly announced it had recovered a flying disc before retracting the statement.',
    },
    {
      id: 'sample-1957-levelland',
      source: 'fsr',
      date: '1957-11-02',
      placeName: 'Levelland, Texas, USA',
      lat: 33.587,
      lon: -102.378,
      locationConfidence: 'medium',
      summary:
        'Several drivers independently reported a glowing object on or near the road and said their engines and lights failed as it came close.',
    },
    {
      id: 'sample-1964-socorro',
      source: 'fsr',
      date: '1964-04-24',
      placeName: 'Socorro, New Mexico, USA',
      lat: 34.04,
      lon: -106.9,
      locationConfidence: 'high',
      summary:
        'A police officer reported an egg-shaped object on the ground outside town, which then rose with a roar and flew off.',
    },
    {
      id: 'sample-1966-westall',
      source: 'fsr',
      date: '1966-04-06',
      placeName: 'Westall, Melbourne, Australia',
      lat: -37.94,
      lon: 145.14,
      locationConfidence: 'high',
      summary:
        'Pupils and staff at two schools reported a disc-like object descending near a paddock and then leaving at speed.',
    },
    {
      id: 'sample-1967-shag-harbour',
      source: 'fsr',
      date: '1967-10-04',
      placeName: 'Shag Harbour, Nova Scotia, Canada',
      lat: 43.49,
      lon: -65.71,
      locationConfidence: 'medium',
      summary:
        'Residents and police reported a lit object coming down into the water offshore; a search found no wreckage.',
    },
    {
      id: 'sample-1976-tehran',
      source: 'us-government',
      date: '1976-09-19',
      placeName: 'Tehran, Iran',
      lat: 35.69,
      lon: 51.39,
      locationConfidence: 'low',
      summary:
        'Air force jets were sent after a bright object over the city, and the crews reported losing instruments and communications when they approached.',
    },
    {
      id: 'sample-1980-rendlesham',
      source: 'fsr',
      date: '1980-12',
      placeName: 'Rendlesham Forest, Suffolk, England',
      lat: 52.09,
      lon: 1.44,
      locationConfidence: 'high',
      summary:
        'Personnel from a nearby air base reported unexplained lights in the forest over more than one night.',
    },
    {
      id: 'sample-1989-eupen',
      source: 'fsr',
      date: '1989-11-29',
      placeName: 'Eupen, Belgium',
      lat: 50.63,
      lon: 6.03,
      locationConfidence: 'medium',
      summary:
        'Police officers and many residents reported a large, slow triangular object with bright lights, at the start of a wave of similar reports.',
    },
    {
      id: 'sample-1994-ruwa',
      source: 'fsr',
      date: '1994-09-16',
      placeName: 'Ruwa, Zimbabwe',
      lat: -17.89,
      lon: 31.24,
      locationConfidence: 'high',
      summary:
        'Dozens of schoolchildren reported seeing a craft land beside their playground during morning break.',
    },
    {
      id: 'sample-1997-phoenix',
      source: 'american-alchemy',
      date: '1997',
      placeName: 'Phoenix, Arizona, USA',
      lat: 33.45,
      lon: -112.07,
      locationConfidence: 'low',
      summary:
        'Thousands of people across the state reported a formation of lights passing overhead on one evening in March.',
    },
    {
      id: 'sample-2004-nimitz',
      source: 'us-government',
      date: '2004-11-14',
      placeName: 'Pacific Ocean off Southern California, USA',
      lat: 31.3,
      lon: -117.2,
      locationConfidence: 'low',
      summary:
        'Navy pilots from a carrier group reported a white, oblong object that out-manoeuvred their jets; an infrared video was later released.',
    },
  ].map((row) => Object.freeze({ ...row, reviewStatus: 'placeholder' })),
);
