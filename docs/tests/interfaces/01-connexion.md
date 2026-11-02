# Fiche de test — Connexion

| | |
|---|---|
| **Route** | `/login` |
| **Livrée par** | S3.1, S3.4, H2a, S3.7 |
| **Accès** | Visiteur non connecté seulement (un utilisateur déjà connecté est redirigé). |
| **Droits** | Aucun droit requis. |
| **Rôles de test** | n/a |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale lancée ; un compte actif (comptes de démonstration).

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Connexion valide** | Saisir l'adresse et le mot de passe d'un compte actif, valider. | Passage à l'écran du second facteur (« étape 2 sur 2 »). | ☐ | |
| 2 | **Mauvais mot de passe** | Saisir une adresse valide et un mauvais mot de passe. | Notice d'échec ; **même message** que pour un compte inconnu (aucune énumération). | ☐ | |
| 3 | **Compte inconnu** | Saisir une adresse qui n'existe pas. | Même message que ci-dessus ; aide permanente sous le formulaire. | ☐ | |
| 4 | **Trop de tentatives** | Répéter les échecs jusqu'à la limite. | Notice d'avertissement ; bouton désactivé avec compte à rebours (60 s), puis réactivé. | ☐ | |
| 5 | **Afficher / masquer le mot de passe** | Cliquer l'œil, puis le recliquer ; envoyer le formulaire. | Masqué par défaut ; 1er clic = visible et annoncé « activé » ; valeur conservée ; remasqué à l'envoi. | ☐ | |
| 6 | **Mot de passe oublié** | Cliquer « Mot de passe oublié ». | Ouverture de l'écran de demande de lien. | ☐ | |
| 7 | **Déjà connecté** | Ouvrir `/login` avec une session active. | Redirection hors de la page de connexion. | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ L'œil est un bouton à pictogramme seul, avec nom accessible et état `aria-pressed`.
- ☐ Le compte à rebours est annoncé sans être répété à chaque seconde.

## Tests automatisés qui couvrent cet écran
- API : `auth-http.integration`, `auth-flows.integration`, `auth-use-cases`
- Web : `h2a.test.ts`, `s37.test.ts`
- Audit navigateur : états de connexion (axe-core)

## Limites connues
- Verrouillage et limitation de débit dépendent de réglages serveur (à vérifier en local).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
