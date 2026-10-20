/** Libellé court et lisible d'un User-Agent (« Chrome sur Windows »). Purement informatif. */
export function deviceLabel(userAgent: string): string {
  const ua = userAgent.slice(0, 400);
  const os = /Windows/i.test(ua) ? 'Windows'
    : /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/i.test(ua) ? 'iOS'
    : /Mac OS X|Macintosh/i.test(ua) ? 'macOS'
    : /Linux/i.test(ua) ? 'Linux'
    : null;
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : null;
  if (browser && os) return `${browser} sur ${os}`;
  return browser ?? os ?? 'Appareil inconnu';
}
