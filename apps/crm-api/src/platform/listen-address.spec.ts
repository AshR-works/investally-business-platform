import { listenAddress } from './listen-address';

describe('adresse d’écoute de l’API', () => {
  it('écoute sur la boucle locale par défaut, y compris avec une valeur vide', () => {
    expect(listenAddress({})).toBe('127.0.0.1');
    expect(listenAddress({ API_HOST: '' })).toBe('127.0.0.1');
    expect(listenAddress({ API_HOST: '   ' })).toBe('127.0.0.1');
  });

  it('accepte une adresse IPv4 (réseau interne d’un conteneur)', () => {
    expect(listenAddress({ API_HOST: '0.0.0.0' })).toBe('0.0.0.0');
    expect(listenAddress({ API_HOST: ' 172.20.0.5 ' })).toBe('172.20.0.5');
    expect(listenAddress({ API_HOST: '255.255.255.255' })).toBe('255.255.255.255');
  });

  it.each(['localhost', '0.0.0', '0.0.0.0.0', '256.0.0.1', '0.0.0.x', '::', '::1', '0.0.0.-1', 'tout'])('refuse « %s » plutôt que d’ouvrir l’API par erreur', (value) => {
    expect(() => listenAddress({ API_HOST: value })).toThrow(/API_HOST/);
  });
});
