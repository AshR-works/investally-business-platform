/**
 * Plage réseau d'une adresse IP, pour détecter un « nouveau réseau » sans être trop sensible aux
 * changements d'adresse au sein d'un même fournisseur : IPv4 → /24, IPv6 → /64. Approximation (pas de géolocalisation).
 */
export function networkRangeOf(ip: string): string {
  const value = (ip ?? '').trim();
  if (value.includes('.') && !value.includes(':')) {
    return value.split('.').slice(0, 3).join('.');
  }
  // IPv4 mappée en IPv6 (::ffff:1.2.3.4)
  const mapped = /^::ffff:(\d+\.\d+\.\d+)\.\d+$/i.exec(value);
  if (mapped) return mapped[1];
  if (value.includes(':')) {
    return value.toLowerCase().split(':').slice(0, 4).join(':');
  }
  return 'unknown';
}

/** Empreinte d'appareil simple (navigateur + système) : suffisante pour signaler un appareil inconnu. */
export function deviceFingerprint(device: string): string {
  return (device ?? '').trim().toLowerCase().slice(0, 300);
}
