// Les règles de forme (e-mail, téléphone) vivent dans le noyau partagé : tous les modules appliquent les mêmes. Ce fichier les réexporte.
export { normalizeEmail, normalizePhone, phoneProblem, PHONE_MIN_DIGITS, PHONE_MAX_DIGITS } from '../../../shared-kernel/contact-format';
