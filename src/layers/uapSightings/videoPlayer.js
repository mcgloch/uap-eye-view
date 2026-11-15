import { t } from '../../i18n/index.js';

/** The page for one DVIDS video, or null when the id is not a DVIDS id. */
export function dvidsPageUrl(id) {
  return /^\d+$/.test(String(id ?? ''))
    ? `https://www.dvidshub.net/video/${id}`
    : null;
}

/** DVIDS's own embeddable player for one video. The footage stays on DVIDS. */
export function dvidsEmbedUrl(id) {
  return /^\d+$/.test(String(id ?? ''))
    ? `https://www.dvidshub.net/video/embed/${id}`
    : null;
}

/**
 * A small in-app player for a sighting's released video. It frames DVIDS's
 * player; nothing is downloaded or rehosted. One video plays at a time.
 *
 * `open` returns false when it cannot show a player (no document, or the
 * Pinokio shell, which sends every framed HTTPS page to the system browser),
 * so the caller can open the video's page instead.
 */
export function createSightingVideoPlayer({
  documentRef = globalThis.document,
  globalRef = globalThis,
} = {}) {
  let root = null;
  let returnFocus = null;
  const pinokioShell = /(?:^|\s)Pinokio\/[^\s]+/i.test(
    globalRef.navigator?.userAgent || '',
  );
  const usable = Boolean(documentRef?.createElement) && !pinokioShell;

  const element = (tag, className, text) => {
    const node = documentRef.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const externalLink = (href, label) => {
    const link = element('a', 'uap-video-link', label);
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  };

  function onKeydown(event) {
    if (event.key !== 'Escape' || !root) return;
    event.stopPropagation();
    close();
  }

  function close() {
    if (!root) return false;
    documentRef.removeEventListener?.('keydown', onKeydown, true);
    // Removing the frame stops playback.
    root.remove();
    root = null;
    returnFocus?.focus?.();
    returnFocus = null;
    return true;
  }

  /**
   * @param {{dvidsId: string, title: string, documentUrl?: string|null}} video
   * @returns {boolean} whether the player opened
   */
  function open({ dvidsId, title, documentUrl = null }) {
    const source = dvidsEmbedUrl(dvidsId);
    if (!usable || !source) return false;
    close();
    returnFocus = documentRef.activeElement || null;

    root = element('section', 'uap-video');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', t('Video: {title}', { title }));

    const header = element('header', 'uap-video-header');
    header.append(element('strong', '', title));
    const closeButton = element('button', 'uap-video-close', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', t('Close video'));
    closeButton.addEventListener('click', close);
    header.append(closeButton);

    const frame = element('iframe', 'uap-video-frame');
    frame.src = source;
    frame.title = t('Video: {title}', { title });
    frame.allow = 'fullscreen; encrypted-media; picture-in-picture';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.loading = 'eager';

    const footer = element('footer', 'uap-video-footer');
    footer.append(
      element(
        'small',
        '',
        t('Video hosted by DVIDS, the U.S. military media service'),
      ),
      externalLink(dvidsPageUrl(dvidsId), t('Open on DVIDS ↗')),
    );
    if (documentUrl && !documentUrl.startsWith('https://www.dvidshub.net/'))
      footer.append(externalLink(documentUrl, t('Open the document ↗')));

    root.append(header, frame, footer);
    documentRef.body.append(root);
    documentRef.addEventListener?.('keydown', onKeydown, true);
    closeButton.focus?.();
    return true;
  }

  return {
    open,
    close,
    isOpen: () => Boolean(root),
  };
}
