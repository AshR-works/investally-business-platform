/**
 * Mots de passe très courants (liste courte, minuscules). LIMITE CONNUE (dette) : à remplacer par une liste
 * de 10 000 entrées en S7. Sert aussi de garde minimale contre les motifs triviaux.
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  'motdepasse', 'motdepasse1', 'motdepasse123', 'azerty', 'azerty123', 'azertyuiop', 'azertyuiop123',
  'qwerty', 'qwerty123', 'qwertyuiop', 'qwerty123456', '123456', '1234567', '12345678', '123456789',
  '1234567890', '12345678910', '123456789012', '111111', '000000', '123123', '123321', '654321',
  'abc123', 'abcd1234', 'abcdefgh', 'abcdefghijkl', 'iloveyou', 'iloveyou123', 'letmein', 'letmein123',
  'welcome', 'welcome1', 'welcome123', 'bienvenue', 'bienvenue123', 'admin', 'admin123', 'admin1234',
  'administrator', 'administrateur', 'root', 'root1234', 'toor', 'changeme', 'changeme123', 'changemenow',
  'investally', 'investally1', 'investally123', 'investally2024', 'investally2025', 'investally2026',
  'investudy', 'investudy123', 'investudy2026', 'cameroun', 'cameroun123', 'douala', 'yaounde',
  'monkey', 'dragon', 'master', 'football', 'baseball', 'superman', 'batman', 'trustno1', 'sunshine',
  'princess', 'shadow', 'michael', 'jennifer', 'charlie', 'login', 'secret', 'secret123', 'default',
  'test', 'test1234', 'testtest', 'azertyazerty', 'qwertyqwerty', 'aaaaaaaaaaaa', '1q2w3e4r', '1q2w3e4r5t',
  'zaq12wsx', 'qazwsx', 'qazwsxedc', 'passpass', 'pass1234', 'motdepasse2026', 'password2026', 'azerty2026',
]);
