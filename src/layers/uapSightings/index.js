import * as Cesium from 'cesium';
import { formatNumber, msg, t, tn } from '../../i18n/index.js';
import {
  registerSpriteCollection,
  restoreSpriteOrder,
  unregisterSpriteCollection,
} from '../../data/spriteOrder.js';
import { createHorizonCull } from '../streetLevel/view.js';
import {
  inPeriod,
  normalizePeriod,
  periodRange,
  yearExtent,
} from '../shipwrecks/period.js';
import { SOURCE_COLORS, SOURCE_LABELS, describeSighting } from './cards.js';
import { LOCATION_CONFIDENCES, UAP_SOURCES } from './records.js';
export * from './records.js';
export * from './cards.js';
export { createUapSightingsSource } from './source.js';

export const UAP_SIGHTINGS_LAYER_ID = 'uap-sightings';
export const UAP_SIGHTINGS_OVERLAY_SOURCE_ID = 'uap-sightings';
const PICK_PREFIX = 'uap-sighting:';
const MARKER_SIZE_PX = 22;
const CARD_HOST_OPTIONS = Object.freeze({
  cohortLimit: 1,
  collisionCapacity: 1,
  moving: false,
});

/**
 * A round marker in the source's colour, as an SVG data URL. The fill shows
 * how well the place is known: solid for a known site, half-filled for an
 * approximate one, a hollow ring for a very approximate one.
 * @param {string} color CSS colour.
 * @param {'high'|'medium'|'low'} confidence
 * @returns {string}
 */
export function sightingMarkerImage(color, confidence) {
  const fill =
    confidence === 'high'
      ? `fill="${color}"`
      : confidence === 'medium'
        ? `fill="${color}" fill-opacity="0.45"`
        : `fill="#0b1420" fill-opacity="0.35"`;
  const ring =
    confidence === 'high'
      ? `stroke="#ffffff" stroke-width="2"`
      : `stroke="${color}" stroke-width="3"${
          confidence === 'low' ? ' stroke-dasharray="4 3"' : ''
        }`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 36 36">` +
    `<circle cx="18" cy="18" r="15" ${fill} ${ring}/>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The sources a filter request names, in the model's order (all when invalid). */
export function normalizeSources(value, current = UAP_SOURCES) {
  if (!Array.isArray(value)) return [...current];
  return UAP_SOURCES.filter((source) => value.includes(source));
}

/**
 * UAP sightings: one marker per reviewed record, coloured by source, with a
 * card, source chips and a period filter.
 */
export function createUapSightingsLayer({
  source,
  overlayHost = null,
  screenSpaceEventHandlerFactory = null,
  picking = null,
  pointer = null,
  openExternal = null,
  createMarkers = (scene) =>
    new Cesium.BillboardCollection({
      scene,
      blendOption: Cesium.BlendOption.TRANSLUCENT,
    }),
} = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('UAP sightings require a snapshot source');
  let _viewer = null;
  let _enabled = false;
  let _markers = null;
  let _request = null;
  let _records = new Map();
  let _pins = [];
  let _version = null;
  let _lastUpdate = null;
  let _lastError = null;
  let _clickHandler = null;
  let _rowListener = null;
  let _selectedId = null;
  let _selectedCardId = null;
  let _selectedLink = null;
  let _sources = [...UAP_SOURCES];
  let _period = { from: null, to: null };
  let _extent = null;
  let _range = null;
  const _images = Object.fromEntries(
    UAP_SOURCES.flatMap((name) =>
      LOCATION_CONFIDENCES.map((confidence) => [
        `${name}:${confidence}`,
        sightingMarkerImage(SOURCE_COLORS[name], confidence),
      ]),
    ),
  );

  const render = () => _viewer?.scene?.requestRender?.();
  const notifyRow = () => _rowListener?.();
  const canSelect = () =>
    overlayHost && screenSpaceEventHandlerFactory && picking;
  const _horizon = createHorizonCull({
    getViewer: () => _viewer,
    items: () => _pins,
    onChange: render,
  });

  /** Shown: its source is switched on and its year is inside the period. */
  function visible(record) {
    return (
      Boolean(record) &&
      _sources.includes(record.source) &&
      inPeriod(record, _range)
    );
  }

  function applyPin(pin) {
    const show = pin.inFront && visible(pin.record);
    if (pin.billboard.show !== show) pin.billboard.show = show;
  }

  function applyFilter() {
    for (const pin of _pins) applyPin(pin);
    if (_selectedId && !visible(_records.get(_selectedId))) clearSelection();
    notifyRow();
    render();
  }

  function rebuild(records) {
    _records = new Map(records.map((record) => [record.id, record]));
    _extent = yearExtent(records);
    _range = periodRange(_period, _extent);
    _pins = [];
    if (!_markers) return;
    _markers.removeAll();
    for (const record of records) {
      const position = Cesium.Cartesian3.fromDegrees(record.lon, record.lat);
      const billboard = _markers.add({
        id: `${PICK_PREFIX}${record.id}`,
        position,
        image: _images[`${record.source}:${record.locationConfidence}`],
        width: MARKER_SIZE_PX,
        height: MARKER_SIZE_PX,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
      const pin = {
        billboard,
        record,
        position,
        inFront: true,
        get show() {
          return this.inFront;
        },
        set show(value) {
          this.inFront = value;
          applyPin(this);
        },
      };
      applyPin(pin);
      _pins.push(pin);
    }
    _horizon.update();
    if (_selectedId && !_records.has(_selectedId)) clearSelection();
    else if (_selectedId) publishCard();
    render();
  }

  // ---- selection card ----------------------------------------------------
  function publishCard() {
    if (!canSelect()) return;
    const record = _selectedId ? _records.get(_selectedId) : null;
    if (!visible(record)) {
      clearSelection();
      return;
    }
    const { title, details, link } = describeSighting(record);
    _selectedLink = link && openExternal ? link : null;
    const card = {
      id: `uap-sighting-card:${record.id}`,
      selected: true,
      interactive: Boolean(_selectedLink),
      title,
      details,
      accent: SOURCE_COLORS[record.source],
      priority: Number.MAX_SAFE_INTEGER,
      gapPx: 15,
      verticalOnly: true,
      placement: 'above',
      stateless: true,
      horizonCull: true,
      position: Cesium.Cartesian3.fromDegrees(record.lon, record.lat),
    };
    if (card.interactive) {
      const target = _selectedLink;
      card.accessibilityLabel = t('Open the source for {title}', { title });
      card.activate = () => {
        openExternal(target);
        return true;
      };
    }
    _selectedCardId = card.id;
    overlayHost.setEntries(
      UAP_SIGHTINGS_OVERLAY_SOURCE_ID,
      [card],
      CARD_HOST_OPTIONS,
    );
    overlayHost.setVisible?.(UAP_SIGHTINGS_OVERLAY_SOURCE_ID, true);
  }

  function clearSelection() {
    _selectedId = null;
    _selectedCardId = null;
    _selectedLink = null;
    overlayHost?.setEntries(
      UAP_SIGHTINGS_OVERLAY_SOURCE_ID,
      [],
      CARD_HOST_OPTIONS,
    );
  }

  function pickedRecordId(picked) {
    const pickId = picking.resolvePickId(picked);
    if (typeof pickId !== 'string' || !pickId.startsWith(PICK_PREFIX))
      return null;
    const id = pickId.slice(PICK_PREFIX.length);
    return _records.has(id) ? id : null;
  }

  function installClickHandler() {
    if (!canSelect() || _clickHandler || !_viewer) return;
    picking.registerPickOwner?.(
      UAP_SIGHTINGS_LAYER_ID,
      (pickedId) =>
        typeof pickedId === 'string' && pickedId.startsWith(PICK_PREFIX),
    );
    _clickHandler = screenSpaceEventHandlerFactory(_viewer);
    _clickHandler.setInputAction((click) => {
      if (pointer && !pointer.isPointerFree()) return;
      const cardHit = overlayHost.hitTest?.(
        click.position?.x,
        click.position?.y,
        { sourceId: UAP_SIGHTINGS_OVERLAY_SOURCE_ID },
      );
      if (cardHit && cardHit.entryId === _selectedCardId) {
        if (_selectedLink) openExternal(_selectedLink);
        return;
      }
      const picked = _viewer.scene.pick(click.position);
      const id = picked ? pickedRecordId(picked) : null;
      if (id) {
        _selectedId = id;
        publishCard();
        render();
        return;
      }
      if (picked) {
        const pickId = picking.resolvePickId(picked);
        if (
          pickId &&
          picking.isOwnedByOtherLayer(UAP_SIGHTINGS_LAYER_ID, pickId)
        )
          return;
      }
      if (_selectedId) {
        clearSelection();
        render();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  function removeClickHandler() {
    _clickHandler?.destroy();
    _clickHandler = null;
    picking?.unregisterPickOwner?.(UAP_SIGHTINGS_LAYER_ID);
  }

  /** Sightings per source inside the period, whether or not the source is on. */
  function sourceCounts() {
    const counts = Object.fromEntries(UAP_SOURCES.map((name) => [name, 0]));
    for (const record of _records.values())
      if (inPeriod(record, _range)) counts[record.source]++;
    return counts;
  }

  function yearsInData(extra = []) {
    const years = new Set(extra);
    for (const record of _records.values()) years.add(record.year);
    return [...years].sort((a, b) => b - a);
  }

  /** The start and end year pickers, side by side. */
  function periodControls() {
    if (!_extent || _extent.min === _extent.max) return {};
    const range = periodRange(_period, _extent);
    const valueText = range.all
      ? t('All years')
      : range.from === range.to
        ? String(range.from)
        : `${range.from}–${range.to}`;
    return {
      range: {
        id: 'period',
        label: t('Period'),
        valueText,
        from: {
          label: t('From'),
          ariaLabel: t('First year of the sighting period'),
          value: range.from,
        },
        to: {
          label: t('To'),
          ariaLabel: t('Last year of the sighting period'),
          value: range.to,
        },
        options: yearsInData([range.from, range.to]).map((year) => ({
          value: year,
          label: String(year),
        })),
        params: (end, value) => ({ [end]: Number(value) }),
      },
    };
  }

  /** One chip per source; a click switches that source on or off. */
  function sourceChips() {
    return UAP_SOURCES.map((name) => {
      const active = _sources.includes(name);
      return {
        id: `source-${name}`,
        label: t(SOURCE_LABELS[name]),
        title: active
          ? t('Hide sightings from this source')
          : t('Show sightings from this source'),
        active,
        state: active ? 'active' : 'idle',
        params: {
          sources: active
            ? _sources.filter((other) => other !== name)
            : [..._sources, name],
        },
      };
    });
  }

  const layer = {
    id: UAP_SIGHTINGS_LAYER_ID,
    name: 'UAP sightings',
    icon: '🛸',
    source: 'war.gov · sample pins',
    // The records ship with the app, so this only reloads after a restart.
    updateInterval: 24 * 60 * 60 * 1000,

    init(viewer) {
      if (_viewer)
        throw new Error('UAP sightings layer is already initialized');
      _viewer = viewer;
      _markers = createMarkers(viewer.scene);
      _markers.show = false;
      viewer.scene.primitives.add(_markers);
      registerSpriteCollection(UAP_SIGHTINGS_LAYER_ID, _markers);
    },

    enable() {
      _enabled = true;
      if (_markers) _markers.show = true;
      restoreSpriteOrder(_viewer);
      installClickHandler();
      if (_pins.length) _horizon.update();
    },

    disable() {
      _enabled = false;
      _request?.abort();
      _request = null;
      if (_markers) _markers.show = false;
      removeClickHandler();
      clearSelection();
      _horizon.stop();
      render();
    },

    async update() {
      if (!_enabled || !_markers) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        const snapshot = await source.getSnapshot({ signal: request.signal });
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        const unchanged =
          typeof snapshot.version === 'string' &&
          snapshot.version === _version &&
          _pins.length > 0;
        _version = snapshot.version ?? null;
        _lastUpdate = Date.now();
        _lastError = null;
        if (!unchanged) rebuild(snapshot.records);
        notifyRow();
        return true;
      } catch (error) {
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        console.warn('[Data:UapSightings] Load error:', error);
        _lastError = error?.message || msg('UAP sightings unavailable');
        notifyRow();
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },

    destroy(viewer = _viewer) {
      layer.disable();
      if (_markers) {
        unregisterSpriteCollection(UAP_SIGHTINGS_LAYER_ID, _markers);
        const primitives = viewer?.scene?.primitives;
        if (primitives && !primitives.isDestroyed?.())
          primitives.remove(_markers);
        _markers = null;
      }
      _records = new Map();
      _pins = [];
      _version = null;
      _viewer = null;
      _rowListener = null;
    },

    /** The filters: `sources` shown, and a `from`/`to` year period (null = whole range). */
    getParams() {
      return { sources: [..._sources], ..._period };
    },

    setParams(params = {}) {
      const sources =
        'sources' in params
          ? normalizeSources(params.sources, _sources)
          : _sources;
      const period = normalizePeriod(params, _period);
      if (
        sources.join() === _sources.join() &&
        period.from === _period.from &&
        period.to === _period.to
      )
        return true;
      _sources = sources;
      _period = period;
      _range = periodRange(_period, _extent);
      applyFilter();
      return true;
    },

    setRowControlsListener(listener) {
      _rowListener = listener;
    },

    getRowControls() {
      const counts = sourceCounts();
      return {
        chips: sourceChips(),
        ...periodControls(),
        legend: UAP_SOURCES.map((name) => ({
          label: t(SOURCE_LABELS[name]),
          count: counts[name],
          color: SOURCE_COLORS[name],
          blurb: tn(counts[name], '{count} sighting', '{count} sightings', {
            count: formatNumber(counts[name]),
          }),
        })),
        info: t('US government records from war.gov · sample pins'),
        infoTitle: t(
          'Colour shows the source. A solid marker is a known site, a faint one is approximate and a dashed ring is very approximate. Cards report what witnesses said and make no claim about what the object was. Click a marker for its card.',
        ),
      };
    },

    getStats() {
      let shown = 0;
      for (const record of _records.values()) if (visible(record)) shown++;
      return {
        count: shown,
        lastUpdate: _lastUpdate,
        stale: false,
        error: _lastError,
      };
    },

    /** Shown records as plain JSON-safe objects, for tools and QA. */
    getAnalystRecords(maxCount = 2000) {
      if (!_enabled) return [];
      const out = [];
      for (const record of _records.values()) {
        if (out.length >= maxCount) break;
        if (!visible(record)) continue;
        out.push({
          id: record.id,
          source: record.source,
          date: record.date,
          datePrecision: record.datePrecision,
          placeName: record.placeName,
          lat: record.lat,
          lon: record.lon,
          locationConfidence: record.locationConfidence,
          reviewStatus: record.reviewStatus,
        });
      }
      return out;
    },
  };
  return layer;
}
