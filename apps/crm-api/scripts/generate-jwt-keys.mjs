// Génère une paire de clés ES256 pour signer les jetons d'accès et l'affiche au format variables d'environnement.
// RIEN n'est écrit sur le disque : copiez les deux lignes dans votre coffre / votre configuration d'hébergement.
//   pnpm crm-api keys:jwt
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const oneLine = (pem) => pem.trim().replace(/\n/g, '\\n');

console.log('# Clés de signature ES256 — à conserver dans un coffre, JAMAIS dans le dépôt.');
console.log('# La clé privée signe les jetons ; la clé publique permettra à l\'ERP de les vérifier.');
console.log(`JWT_PRIVATE_KEY_PEM="${oneLine(privateKey.export({ type: 'pkcs8', format: 'pem' }))}"`);
console.log(`JWT_PUBLIC_KEY_PEM="${oneLine(publicKey.export({ type: 'spki', format: 'pem' }))}"`);
