# Protocole d'écoute avec un vrai lecteur d'écran

**Pourquoi ce document** : l'audit automatique (`scripts/a11y-audit.mjs`) vérifie ce que le navigateur *expose* aux technologies d'assistance (rôles, noms, ordre, focus). Il **ne remplace pas** l'écoute réelle : seul un lecteur d'écran dit comment l'interface *sonne*. Cette écoute doit être faite par une personne (idéalement une personne qui utilise un lecteur d'écran au quotidien), sur une pile de **test** (base jetable, jamais la production).

**Durée** : environ 45 minutes. **Outils** : NVDA (Windows, gratuit) + Firefox ou Edge ; en complément Narrator (Windows) ; VoiceOver (macOS/iOS) et TalkBack (Android) si l'équipe a des appareils.

## Préparation
1. Lancer la pile de test (voir `docs/SPRINT-3.4-RECETTE.md`) avec `EMAIL_PROVIDER=log` et `EMAIL_LOG_CONTENT=true` (les liens sont lus dans le journal de l'API, aucun e-mail réel n'est envoyé).
2. Créer un SuperAdmin de test (`admin:create`, mot de passe fourni par variable d'environnement).
3. Écran éteint ou yeux fermés ; navigation **au clavier et au lecteur d'écran uniquement** (pas de souris).

## Scénarios (à cocher)
| # | Scénario | Ce qui doit être entendu / constaté | OK |
|---|---|---|---|
| 1 | Ouvrir `/login` | Titre de page « Connexion — Investally CRM » ; focus dans « Adresse e-mail » ; champs annoncés « obligatoire » | ☐ |
| 2 | Soumettre un mauvais mot de passe | Le message d'erreur est **annoncé spontanément** sans déplacer le focus | ☐ |
| 3 | « Mot de passe oublié ? » puis envoi | Le titre de page change ; confirmation annoncée (même texte pour toute adresse) | ☐ |
| 4 | Connexion puis configuration MFA | Le QR code est décrit (alternative texte) **et** la clé manuelle est lisible lettre par lettre ; le champ code est annoncé comme code à usage unique | ☐ |
| 5 | Saisir un faux code | Erreur annoncée ; le focus reste dans le champ | ☐ |
| 6 | Codes de secours | Le groupe « Codes de secours » est lu en entier ; la case de confirmation est annoncée avec son état | ☐ |
| 7 | Navigation principale | Repère « Navigation principale » ; le lien de la page courante est annoncé « page courante » | ☐ |
| 8 | Page Entreprises : tableau | En-têtes de colonnes annoncés à chaque cellule ; ordre de lecture logique | ☐ |
| 9 | Administration : « Inviter un utilisateur » | La fenêtre est annoncée (boîte de dialogue), **le fond n'est plus lisible**, Tab reste dans la fenêtre | ☐ |
| 10 | Fermer par Échap | Le focus revient sur le bouton « Inviter un utilisateur » | ☐ |
| 11 | Action sensible (désactiver un compte) puis demande de code MFA | La fenêtre de code est annoncée et utilisable ; le résultat est annoncé | ☐ |
| 12 | Mon compte : tableau des sessions | La dernière colonne est annoncée « Actions » | ☐ |
| 13 | Changer de page au clavier | Le nouveau titre de page est annoncé | ☐ |
| 14 | Zoom 200 % et mode contraste élevé de Windows | Aucune perte d'information, aucun texte coupé | ☐ |

## Comment consigner
Pour chaque ligne non cochée : outil et version, ce qui a été entendu, ce qui était attendu, capture ou enregistrement audio si possible. Les écarts sont inscrits dans `docs/TECH-DEBT.md` (dette D28) ou corrigés dans un sprint dédié.

## Limites assumées
- Chaque lecteur d'écran interprète le HTML un peu différemment (NVDA + Firefox, JAWS + Chrome, VoiceOver + Safari ne disent pas exactement la même chose). Un seul outil ne prouve pas la conformité pour tous.
- Une conformité WCAG complète exige aussi un audit d'expert (contenus dynamiques, cas limites). L'audit automatique détecte une partie seulement des problèmes connus.
