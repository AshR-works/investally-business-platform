# Fiche de test — Administration des utilisateurs

| | |
|---|---|
| **Route** | `/admin/users` |
| **Livrée par** | S3.3, S3.4, S3.8 |
| **Accès** | Utilisateur disposant des droits `iam.user.*` (Super administrateur). |
| **Droits** | `iam.user.read`, `create`, `update`, `disable`, `assign_role`, `reset_mfa`, `reset_password`, `iam.session.revoke` (portée Tous). |
| **Rôles de test** | sa |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Compte Super administrateur ; un compte de test à administrer.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Liste, recherche, filtre** | Rechercher un nom, filtrer par état, paginer. | Résultats cohérents ; pagination exacte. | ☐ | |
| 2 | **Inviter** | Cliquer « Inviter » : adresse, nom, rôles, responsable facultatif. | Invitation créée ; lien dans le journal local ; adresse déjà utilisée refusée. | ☐ | |
| 3 | **Choisir les rôles (UX-02)** | Ouvrir le sélecteur de rôles. | Rôles regroupés par familles ; aperçu des droits effectifs (la portée la plus large l'emporte). | ☐ | |
| 4 | **Pas d'auto-attribution** | Essayer de se modifier ses propres rôles. | Refusé. | ☐ | |
| 5 | **Désactiver / réactiver** | Désactiver un compte, puis le réactiver. | Confirmation ; le compte désactivé ne peut plus se connecter. | ☐ | |
| 6 | **Réinitialiser le mot de passe / le MFA** | Déclencher chaque action, confirmer. | Lien de réinitialisation (journal local) ; MFA à reconfigurer à la prochaine connexion. | ☐ | |
| 7 | **Couper les sessions** | Couper les sessions d'un utilisateur. | Ses sessions sont fermées. | ☐ | |
| 8 | **Boutons selon les droits** | Se connecter avec un compte sans ces droits. | La page et les actions ne sont pas proposées ; l'accès direct est refusé (403). | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab et Maj+Tab parcourent tous les contrôles dans un ordre logique ; le focus est toujours visible ; aucun piège de focus hors fenêtre modale.
- ☐ Un seul titre de niveau 1 ; pas de saut de niveau (h2 avant h3).
- ☐ Chaque champ a un libellé relié ; un champ non conforme est en surbrillance **et** accompagné d'un message écrit relié (`aria-describedby`), jamais la couleur seule ; le focus va au premier champ en erreur.
- ☐ Les messages d'état et d'erreur sont annoncés (`role=alert` ou `aria-live`).
- ☐ Fenêtres modales : le focus entre dans la fenêtre, Échap la ferme, le focus revient à l'élément d'origine, l'arrière-plan est inerte.
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page.
- ☐ Le sélecteur de rôles est utilisable au clavier ; l'aperçu des droits est annoncé.

## Tests automatisés qui couvrent cet écran
- API : `admin-flows.integration`, `admin-use-cases`, `rbac-http.integration`, `route-protection.spec`
- Web : `s38.test.ts`, `lib.test.ts`
- Recette : S3.3 (matrice de droits générée), S3.8

## Limites connues
- Un second Super administrateur n'existe pas encore (prérequis externe).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
