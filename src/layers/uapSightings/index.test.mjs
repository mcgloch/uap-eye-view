import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import * as picking from '../../data/pickRegistry.js';
import {
  createUapSightingsLayer,
  normalizeSightings,
  sightingMarkerImage,
} from './index.js';

const sighting = (id, extra = {}) => ({
  id,
  source: 'fsr',
  date: '1967-09',
  placeName: id,
  lat: 50,
  lon: -1,
  locationConfidence: 'high',
  summary: 'A witness reported a light.',
  reviewStatus: 'published',
  ...extra,
});

function harness(rows, version = 'v1') {
  const markers = {
    show: true,
    billboards: [],
    rebuilds: 0,
    add(options) {
      const billboard = { show: true, ...options };
      markers.billboards.push(billboard);
      return billboard;
    },
    removeAll() {
      markers.rebuilds++;
      markers.billboards = [];
    },
  };
  const primitives = [];
  const cards = [];
  const handlers = [];
  const opened = [];
  let pickResult = null;
  const viewer = {
    camera: { positionWC: Cesium.Cartesian3.fromDegrees(-1, 50, 2e6) },
    scene: {
      canvas: {},
      requestRender() {},
      pick: () => pickResult,
      preRender: { addEventListener: () => () => {} },
      primitives: {
        add: (primitive) => primitives.push(primitive),
        remove: (primitive) =>
          primitives.splice(primitives.indexOf(primitive), 1),
        raiseToTop() {},
        contains: (primitive) => primitives.includes(primitive),
      },
    },
  };
  const layer = createUapSightingsLayer({
    source: {
      getSnapshot: async () => ({
        records: normalizeSightings(rows),
        version,
      }),
    },
    createMarkers: () => markers,
    overlayHost: {
      setEntries: (_source, entries) => cards.push(entries),
      setVisible() {},
      hitTest: () => null,
    },
    screenSpaceEventHandlerFactory: () => {
      const handler = {
        setInputAction(callback) {
          handler.click = callback;
        },
        destroy() {},
      };
      handlers.push(handler);
      return handler;
    },
    picking,
    pointer: { isPointerFree: () => true },
    openExternal: (url) => opened.push(url),
  });
  layer.init(viewer);
  return {
    layer,
    markers,
    primitives,
    opened,
    click(id) {
      pickResult = id ? { id: `uap-sighting:${id}` } : null;
      handlers.at(-1).click({ position: { x: 1, y: 1 } });
    },
    lastCard: () => cards.at(-1),
    shown: () =>
      markers.billboards
        .filter((billboard) => billboard.show)
        .map((billboard) => billboard.id.replace('uap-sighting:', '')),
  };
}

test('the layer needs a snapshot source', () => {
  assert.throws(() => createUapSightingsLayer({}), TypeError);
});

test('markers live in one collection, shown only while the layer is on', async () => {
  const h = harness([sighting('a'), sighting('b')]);
  assert.deepEqual(h.primitives, [h.markers]);
  assert.equal(h.markers.show, false);
  assert.equal(await h.layer.update(), false);
  h.layer.enable();
  assert.equal(h.markers.show, true);
  assert.equal(await h.layer.update(), true);
  assert.equal(h.layer.getStats().count, 2);
  assert.equal(await h.layer.update(), true);
  assert.equal(h.markers.rebuilds, 1);
  h.layer.disable();
  assert.equal(h.markers.show, false);
  assert.deepEqual(h.layer.getAnalystRecords(), []);
  h.layer.destroy();
  assert.deepEqual(h.primitives, []);
});

test('the marker shows the source by colour and the confidence by fill', async () => {
  const h = harness([
    sighting('a', { source: 'us-government', locationConfidence: 'low' }),
    sighting('b'),
  ]);
  h.layer.enable();
  await h.layer.update();
  const [low, high] = h.markers.billboards;
  assert.notEqual(low.image, high.image);
  assert.match(
    decodeURIComponent(sightingMarkerImage('#123456', 'low')),
    /stroke-dasharray/,
  );
  assert.doesNotMatch(
    decodeURIComponent(sightingMarkerImage('#123456', 'high')),
    /stroke-dasharray|fill-opacity/,
  );
});

test('source chips and the period hide markers and are counted', async () => {
  const h = harness([
    sighting('old', { date: '1947' }),
    sighting('mid', { date: '1967-09', source: 'american-alchemy' }),
    sighting('new', { date: '2004-11-14', source: 'us-government' }),
  ]);
  let rowChanges = 0;
  h.layer.setRowControlsListener(() => rowChanges++);
  h.layer.enable();
  await h.layer.update();
  assert.deepEqual(h.shown(), ['old', 'mid', 'new']);

  const chips = h.layer.getRowControls().chips;
  assert.deepEqual(
    chips.map((chip) => chip.active),
    [true, true, true],
  );
  // A click on the first chip switches Flying Saucer Review off.
  h.layer.setParams(chips[0].params);
  assert.deepEqual(h.shown(), ['mid', 'new']);
  assert.equal(h.layer.getRowControls().chips[0].active, false);
  assert.equal(h.layer.getStats().count, 2);
  h.layer.setParams(h.layer.getRowControls().chips[0].params);
  assert.deepEqual(h.shown(), ['old', 'mid', 'new']);

  h.layer.setParams({ from: 1960 });
  assert.deepEqual(h.shown(), ['mid', 'new']);
  const controls = h.layer.getRowControls();
  assert.equal(controls.range.valueText, '1960–2004');
  assert.deepEqual(
    controls.range.options.map((option) => option.value),
    [2004, 1967, 1960, 1947],
  );
  assert.deepEqual(
    controls.legend.map((entry) => entry.count),
    [0, 1, 1],
  );
  assert.deepEqual(h.layer.getParams(), {
    sources: ['fsr', 'american-alchemy', 'us-government'],
    from: 1960,
    to: null,
  });
  assert.ok(rowChanges >= 3);
  h.layer.setParams({ sources: 'fsr' });
  assert.deepEqual(h.shown(), ['mid', 'new']);
});

test('a click opens the card; filtering the sighting out closes it', async () => {
  const h = harness([
    sighting('a', { media: { url: 'https://example.gov/a.pdf' } }),
    sighting('b', { source: 'us-government' }),
  ]);
  h.layer.enable();
  await h.layer.update();
  h.click('a');
  const [card] = h.lastCard();
  assert.equal(card.title, 'UAP sighting · a');
  assert.equal(card.interactive, true);
  assert.equal(card.activate(), true);
  assert.deepEqual(h.opened, ['https://example.gov/a.pdf']);
  h.click('b');
  assert.equal(h.lastCard()[0].interactive, false);
  h.layer.setParams({ sources: ['fsr'] });
  assert.deepEqual(h.lastCard(), []);
  h.click('a');
  h.click(null);
  assert.deepEqual(h.lastCard(), []);
  h.layer.destroy();
});
