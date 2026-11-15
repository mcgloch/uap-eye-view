import '../../testSupport/registerDom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSightingVideoPlayer,
  dvidsEmbedUrl,
  dvidsPageUrl,
} from './videoPlayer.js';

// The frame must not fetch DVIDS during a test.
window.happyDOM.settings.disableIframePageLoading = true;

test('only a numeric DVIDS id makes a player or page address', () => {
  assert.equal(
    dvidsEmbedUrl('1006056'),
    'https://www.dvidshub.net/video/embed/1006056',
  );
  assert.equal(dvidsPageUrl(1006056), 'https://www.dvidshub.net/video/1006056');
  for (const bad of ['', null, undefined, '12a', '../x', 'https://evil.test'])
    assert.equal(dvidsEmbedUrl(bad), null, String(bad));
});

test('the player frames DVIDS, links out, and closes on its button', () => {
  const player = createSightingVideoPlayer();
  assert.equal(player.isOpen(), false);
  assert.equal(
    player.open({
      dvidsId: '1006056',
      title: 'UAP sighting · Iraq',
      documentUrl: 'https://www.war.gov/medialink/ufo/a.pdf',
    }),
    true,
  );
  const root = document.querySelector('.uap-video');
  assert.equal(root.getAttribute('role'), 'dialog');
  assert.equal(root.getAttribute('aria-label'), 'Video: UAP sighting · Iraq');
  const frame = root.querySelector('iframe');
  assert.equal(frame.src, 'https://www.dvidshub.net/video/embed/1006056');
  assert.equal(frame.title, 'Video: UAP sighting · Iraq');
  const links = [...root.querySelectorAll('a')];
  assert.deepEqual(
    links.map((link) => [link.textContent, link.href, link.target, link.rel]),
    [
      [
        'Open on DVIDS ↗',
        'https://www.dvidshub.net/video/1006056',
        '_blank',
        'noopener noreferrer',
      ],
      [
        'Open the document ↗',
        'https://www.war.gov/medialink/ufo/a.pdf',
        '_blank',
        'noopener noreferrer',
      ],
    ],
  );
  const close = root.querySelector('button');
  assert.equal(close.getAttribute('aria-label'), 'Close video');
  assert.ok(document.activeElement === close, 'the close button has focus');
  close.click();
  assert.equal(player.isOpen(), false);
  assert.equal(document.querySelector('.uap-video'), null);
});

test('one video plays at a time, and Escape closes it', () => {
  const player = createSightingVideoPlayer();
  player.open({ dvidsId: '1', title: 'First' });
  player.open({
    dvidsId: '2',
    title: 'Second',
    documentUrl: 'https://www.dvidshub.net/video/2',
  });
  const players = document.querySelectorAll('.uap-video');
  assert.equal(players.length, 1);
  assert.match(players[0].querySelector('iframe').src, /embed\/2$/);
  // The DVIDS page is already linked: no second link to it as "the document".
  assert.equal(players[0].querySelectorAll('a').length, 1);
  document.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'a', bubbles: true }),
  );
  assert.equal(player.isOpen(), true);
  document.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );
  assert.equal(player.isOpen(), false);
  assert.equal(player.close(), false);
});

test('without a usable page the player declines, so the caller links out', () => {
  assert.equal(
    createSightingVideoPlayer({ documentRef: null }).open({
      dvidsId: '1',
      title: 'T',
    }),
    false,
  );
  const pinokio = createSightingVideoPlayer({
    globalRef: { navigator: { userAgent: 'Mozilla/5.0 Pinokio/3.9.0' } },
  });
  assert.equal(pinokio.open({ dvidsId: '1', title: 'T' }), false);
  assert.equal(
    createSightingVideoPlayer().open({ dvidsId: 'nope', title: 'T' }),
    false,
  );
  assert.equal(document.querySelector('.uap-video'), null);
});
