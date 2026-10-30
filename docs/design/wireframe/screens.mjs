// Description des wireframes : un objet par écran. Le moteur (`build.mjs`) les dessine en SVG.
// `status` : « Livré » (écran déjà réalisé, repris pour référence) ou « Proposé » (à valider par la direction produit).
// Les notes (`note`) deviennent des pastilles numérotées ; `states` liste les états à concevoir pour l'écran.

export const MODULES = {
  'Accès': { nav: 'Compte', short: 'Compte' },
  'Vue d’ensemble': { nav: 'Hub', short: 'Hub' },
  'Business Development': { nav: 'BD', short: 'Commercial' },
  'Investudy': { nav: 'Investudy', short: 'Investudy' },
  'Stocks': { nav: 'Stocks', short: 'Stocks' },
  'Finance': { nav: 'Finance', short: 'Finance' },
  'RH et fiscalité': { nav: 'RH', short: 'RH · Fisc.' },
  'Reporting': { nav: 'Reporting', short: 'Reporting' },
  'Administration': { nav: 'Admin', short: 'Admin' },
};

const title = (text, sub, actions, primary) => ({ t: 'title', text, sub, actions, primary });
const tabs = (items, active = 0, note) => ({ t: 'tabs', items, active, note });
const kpis = (items, note) => ({ t: 'kpis', items, note });
const table = (cols, rows, o = {}) => ({ t: 'table', cols, rows, ...o });
const cards = (items, o = {}) => ({ t: 'cards', items, ...o });
const form = (fields, o = {}) => ({ t: 'form', fields, ...o });
const kv = (items, o = {}) => ({ t: 'kv', items, ...o });
const panel = (titleText, children, o = {}) => ({ t: 'panel', title: titleText, children, ...o });
const cols = (widths, children, o = {}) => ({ t: 'cols', widths, children, ...o });
const chart = (label, kind, o = {}) => ({ t: 'chart', label, kind, ...o });
const timeline = (steps, current, note) => ({ t: 'timeline', steps, current, note });
const kanban = (columns, note) => ({ t: 'kanban', columns, note });
const calendar = (events, o = {}) => ({ t: 'calendar', events, ...o });
const list = (titleText, items, o = {}) => ({ t: 'list', title: titleText, items, ...o });
const banner = (text, tone, note) => ({ t: 'banner', text, tone, note });
const placeholder = (label, h, note) => ({ t: 'placeholder', label, h, note });
const buttons = (items, align) => ({ t: 'buttons', items, align });

const AM = 'Chargé de compte';
const HOS = 'Responsable commercial';
const COMMON_STATES = ['Chargement', 'Vide', 'Erreur (réessayer)', 'Droits réduits', 'Thème sombre', 'Largeur < 1024 px'];

const companies = [
  ['Atlas Négoce', 'Négoce', 'Cameroun', '● Cible', '28/10/2026'],
  ['Banque Horizon', 'Banque', 'Gabon', '● Contactée', '27/10/2026'],
  ['Sodexim', 'Industrie', 'Cameroun', '● Qualifiée', '24/10/2026'],
  ['Assur+ Afrique', 'Assurance', 'Sénégal', '● Cliente', '20/10/2026'],
  ['Énergia Group', 'Énergie', 'Côte d’Ivoire', '● Cible', '18/10/2026'],
];

export const SCREENS = [
  // ───────────────────────────── Accès (livré) ─────────────────────────────
  {
    id: 'connexion', title: 'Connexion', module: 'Accès', status: 'Livré', sprint: 'S3.1 / H2', shell: 'auth', role: 'Tout utilisateur', rights: 'Route publique ; verrouillage après échecs répétés.',
    blocks: [
      panel(null, [
        { t: 'title', text: 'Connexion', sub: 'Accédez à votre espace de travail Investally.' },
        form([['Adresse e-mail *', 'text', 1], ['Mot de passe * (œil : afficher)', 'text', 1]], { cols: 1, note: 'Mot de passe masqué par défaut ; bouton « œil » unique ; correction orthographique coupée (EXD-12).' }),
        buttons(['Se connecter']),
        { t: 'list', items: [['Mot de passe oublié ?', '']] },
      ], { note: 'Un code de l’application d’authentification est demandé à l’étape suivante (MFA obligatoire).' }),
    ],
    states: ['Identifiants invalides (message unique, sans dire lequel)', 'Compte verrouillé', 'Thème sombre'],
  },
  {
    id: 'mfa-code', title: 'Second facteur : code à six chiffres', module: 'Accès', status: 'Livré', sprint: 'S3.2 / H2', shell: 'auth', role: 'Tout utilisateur', rights: 'Après un mot de passe correct.',
    blocks: [
      panel(null, [
        { t: 'title', text: 'Vérification', sub: 'Saisissez le code de votre application d’authentification.' },
        { t: 'code', note: 'Six cases (DDR-0009) ; collage d’un code complet accepté ; validation automatique à la sixième.' },
        buttons(['Vérifier']),
        { t: 'list', items: [['Utiliser un code de secours', '']] },
      ]),
    ],
    states: ['Code erroné', 'Trop de tentatives', 'Première connexion : enrôlement par QR code'],
  },
  {
    id: 'hub', title: 'Vue d’ensemble (hub)', module: 'Vue d’ensemble', status: 'Livré', sprint: 'H1', nav: 'Hub', role: AM, user: 'Marie Nkoulou', rights: 'Chaque module n’apparaît que si une permission le justifie.',
    blocks: [
      title('Bonjour Marie', 'Vos modules et vos priorités du jour'),
      cards([['Entreprises', '24 entreprises dans votre portée', 'Business Development'], ['Opportunités', '6 en cours', 'Business Development'], ['Agenda', '3 rendez-vous cette semaine', 'Business Development'], ['Investudy', 'Sessions et inscriptions', 'Formation'], ['Documents', 'Pièces jointes', 'Transverse'], ['Mon compte', 'Sécurité et sessions', 'Accès']], { cols: 3, h: 110, note: 'Navigation complète uniquement ici (EXD-05) ; le rail compact sert ailleurs.' }),
      list('À faire aujourd’hui', [['Relancer Atlas Négoce (offre déposée le 20/10)', '14h'], ['Préparer le RDV décideur Sodexim', 'Demain'], ['Verser la commission du dossier Banque Horizon', 'En attente DAF']], { note: 'Alimenté par l’agenda et les relances (S4.2).' }),
    ],
    states: COMMON_STATES,
  },
  {
    id: 'entreprises-liste', title: 'Entreprises : liste', module: 'Business Development', status: 'Livré', sprint: 'S1 / H1b', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'bd.company.read (Propre, Équipe ou Tous).',
    blocks: [
      title('Entreprises', 'Les entreprises cibles visibles selon votre périmètre', ['Nouvelle entreprise']),
      table(['Entreprise', 'Secteur', 'Pays', 'Statut', 'Créée le'], companies, { filters: ['Statut', 'Pays'], count: '24 entreprises', selected: 1, note: 'Sélection persistante (EXD-02) ; le nom ouvre la fiche. Colonnes à choisir, tri et filtres : lot « tableaux » de S4.1.' }),
    ],
    states: ['Vide : « Aucune entreprise pour le moment » + bouton Nouvelle entreprise', ...COMMON_STATES],
  },
  {
    id: 'entreprise-fiche', title: 'Fiche entreprise (état actuel)', module: 'Business Development', status: 'Livré', sprint: 'S3.6 / S4.0', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'bd.company.read ; Modifier : bd.company.update ; commission : bd.commission.read.',
    blocks: [
      title('Atlas Négoce', 'Fiche de l’entreprise', ['Exporter la fiche', 'Modifier'], true),
      panel(null, [kv([['Statut', '● Cible'], ['Secteur', 'Négoce'], ['Pays', 'Cameroun'], ['E-mail', 'contact@atlas.cm'], ['Téléphone', '+237 222 33 44 55'], ['Créée le', '28/10/2026']], { cols: 6 })], { note: 'Export : qui voit exporte, chaque export est tracé (DDR-0014).' }),
      panel('Mise en relation', [kv([['Facilitateur', 'Paul Mbarga'], ['Téléphone', '+237 699 00 11 22'], ['Méthode de contact', 'Appel téléphonique'], ['Commission', '7,50 %']], { cols: 4 })], { note: 'La commission n’apparaît que pour qui a la permission ; sinon la clé est absente.' }),
      list('Documents', [['Exemple de facture · version 2', 'Non analysé'], ['Décharge signée · version 1', 'Non analysé']], { note: 'Versions, empreinte SHA-256, historique, archivage (S3.6).' }),
    ],
    states: ['Entreprise introuvable (hors portée = même message qu’un identifiant inexistant)', 'Modification concurrente : version périmée'],
  },
  {
    id: 'entreprise-modal', title: 'Création et modification d’une entreprise', module: 'Business Development', status: 'Livré', sprint: 'S4.0', nav: 'BD', role: HOS, user: 'Jean Ekani', rights: 'bd.company.create / update ; commission : bd.commission.manage.',
    blocks: [title('Entreprises', 'Les entreprises cibles visibles selon votre périmètre', ['Nouvelle entreprise']), table(['Entreprise', 'Secteur', 'Pays', 'Statut', 'Créée le'], companies.slice(0, 3), { filters: ['Statut'] })],
    modal: {
      title: 'Nouvelle entreprise', w: 760, actions: ['Annuler', 'Enregistrer'], note: 'Croix en haut à droite (EXD-15) ; champs non conformes en surbrillance avec message écrit (EXD-16) ; zone de commentaire à taille fixe.',
      blocks: [
        panel('L’entreprise', [form([['Nom de l’entreprise *'], ['Pays d’affiliation'], ['E-mail de l’entreprise'], ['Téléphone de l’entreprise'], ['Secteur d’activité']], { cols: 2 })]),
        panel('Mise en relation', [form([['Facilitateur', 'select'], ['Méthode de prise de contact', 'select'], ['Nom du facilitateur *'], ['Prénom du facilitateur *'], ['Téléphone du facilitateur *'], ['Commission', 'select'], ['Commentaire sur le facilitateur', 'area', 2], ['Le facilitateur est un employé de l’entreprise', 'check', 2]], { cols: 2 })]),
      ],
    },
    states: ['Erreurs de saisie listées', 'Doublon de nom (conflit)', 'Sans droit de commission : note explicative'],
  },
  {
    id: 'utilisateurs', title: 'Utilisateurs (administration)', module: 'Administration', status: 'Livré', sprint: 'S3.3 / H2', nav: 'Admin', role: 'Super administrateur', user: 'Admin local', rights: 'iam.user.* (Super administrateur seulement).',
    blocks: [
      title('Utilisateurs', 'Comptes, rôles et sessions', ['Inviter un utilisateur']),
      table(['Utilisateur', 'E-mail', 'Rôles', 'État', 'Dernière connexion'], [['Marie Nkoulou', 'marie@…', 'Chargé de compte', '● Actif', 'Aujourd’hui'], ['Jean Ekani', 'jean@…', 'Responsable commercial', '● Actif', 'Hier'], ['Henri Bebey', 'henri@…', 'Super administrateur', '● Actif', 'Aujourd’hui'], ['Paul Atangana', 'paul@…', 'Fiscalité', '● En attente', '—']], { filters: ['Rôle', 'État'], note: 'Actions par ligne : rôles, désactiver, réinitialiser le MFA ou le mot de passe, révoquer les sessions (confirmées, EXD-13).' }),
    ],
    states: COMMON_STATES,
  },
  {
    id: 'roles-modal', title: 'Rôles d’un utilisateur : sélecteur et aperçu des droits', module: 'Administration', status: 'Livré', sprint: 'S3.8', nav: 'Admin', role: 'Super administrateur', user: 'Admin local', rights: 'iam.user.assign_role ; on ne modifie pas ses propres rôles.',
    blocks: [title('Utilisateurs', 'Comptes, rôles et sessions'), table(['Utilisateur', 'Rôles', 'État'], [['Marie Nkoulou', 'Chargé de compte', '● Actif']], { toolbar: false })],
    modal: {
      title: 'Rôles de Marie Nkoulou', w: 980, actions: ['Annuler', 'Enregistrer'], note: 'Familles de rôles, cartes cliquables ; aperçu des droits effectifs collé en haut ; « Sera ajouté / Sera retiré » (EXD-14).',
      blocks: [cols([2, 3], [[cards([['Chargé de compte', '38 permissions'], ['Responsable commercial', '55 permissions', 'Sera ajouté'], ['Support', '12 permissions', 'Sera retiré']], { cols: 1, h: 84, selected: 1 })], [panel('Droits effectifs', [list(null, [['Business Development · Entreprises', 'Équipe'], ['Business Development · Opportunités', 'Équipe'], ['Documents', 'Équipe']])])]])],
    },
    states: ['Aucun rôle choisi (Enregistrer désactivé)', 'Rôle à accès complet : avertissement d’audit', 'Ses propres rôles : sélection bloquée'],
  },
  {
    id: 'mon-compte', title: 'Mon compte : sécurité et sessions', module: 'Accès', status: 'Livré', sprint: 'H2', nav: 'Compte', role: 'Tout utilisateur', user: 'Marie Nkoulou', rights: 'iam.session.read / revoke (Propre).',
    blocks: [
      title('Mon compte', 'Mot de passe, double authentification et appareils connectés'),
      cols([1, 2], [[panel('Sécurité', [list(null, [['Changer le mot de passe', ''], ['Régénérer les codes de secours', 'Étape de confirmation'], ['Historique des connexions', '']])])], [table(['Appareil', 'Adresse', 'Dernière activité', 'État'], [['Edge · Windows', '127.0.0.1', 'Maintenant', '● Cette session'], ['Chrome · Android', '10.0.0.4', 'Hier', '● Active']], { toolbar: false, select: false, note: 'Révoquer une session ou « tous mes autres appareils », avec confirmation (EXD-13).' })]]),
    ],
    states: ['Codes de secours affichés une seule fois', ...COMMON_STATES],
  },

  // ───────────────────────────── Business Development (proposé) ─────────────────────────────
  {
    id: 'entreprise-360', title: 'Fiche entreprise 360° (cible)', module: 'Business Development', status: 'Proposé', sprint: 'S4.1 à S4.3', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'Chaque onglet suit ses propres permissions (contacts, offres, opportunités, documents).',
    blocks: [
      title('Atlas Négoce', 'Négoce · Cameroun · propriétaire : Marie Nkoulou', ['Exporter la fiche', 'Modifier', 'Nouvelle action'], true),
      kpis([['Statut', '● Qualifiée'], ['Opportunités ouvertes', '2'], ['Prochaine action', 'RDV décideur', 'Jeudi 14h'], ['Dernier contact', '3 jours', 'Appel']]),
      tabs(['Vue d’ensemble', 'Contacts', 'Offres', 'Rendez-vous', 'Opportunités', 'Documents', 'Historique'], 0, 'Un onglet n’est affiché que si l’utilisateur a le droit de lire son contenu ; l’onglet actif est conservé dans l’adresse.'),
      cols([2, 1], [[panel('Coordonnées et mise en relation', [kv([['E-mail', 'contact@atlas.cm'], ['Téléphone', '+237 222 33 44 55'], ['Facilitateur', 'Paul Mbarga'], ['Méthode', 'Appel'], ['Commission', '7,50 %'], ['Pays', 'Cameroun']], { cols: 3 })]), list('Contacts clés', [['Directeur administratif et financier : A. Fotso', 'DAF'], ['Directrice générale : C. Ndzana', 'Décideur']])], [panel('Chronologie', [list(null, [['Offre déposée', '20/10'], ['RDV DAF tenu', '22/10'], ['Relance planifiée', '30/10']])], { note: 'Historique alimenté par les actions et l’audit métier ; filtrable.' })]]),
    ],
    states: ['Onglet vide avec action « Ajouter »', 'Onglet sans droit : masqué', ...COMMON_STATES],
  },
  {
    id: 'contacts-liste', title: 'Contacts : liste', module: 'Business Development', status: 'Livré', sprint: 'S4.1a', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'bd.contact.read ; portée selon l’entreprise liée.',
    blocks: [
      title('Contacts', 'Interlocuteurs des entreprises de votre périmètre', ['Nouveau contact']),
      table(['Contact', 'Fonction', 'Entreprise', 'E-mail', 'Téléphone'], [['Alain Fotso', 'DAF', 'Atlas Négoce', 'a.fotso@…', '+237 6…'], ['Claire Ndzana', 'Décideur', 'Atlas Négoce', 'c.ndzana@…', '+237 6…'], ['Marc Eto', 'DAF', 'Sodexim', 'm.eto@…', '+237 6…'], ['Sandrine Njoya', 'Autre', 'Banque Horizon', 's.njoya@…', '+241 0…']], { filters: ['Fonction', 'Entreprise'], count: '38 contacts', note: 'Fonction : DAF, décideur ou autre (liste à confirmer) ; un contact appartient à une entreprise.' }),
    ],
    states: ['Vide : « Aucun contact » + action', ...COMMON_STATES],
  },
  {
    id: 'contact-modal', title: 'Création d’un contact (avec détection de doublon)', module: 'Business Development', status: 'Livré', sprint: 'S4.1a', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'bd.contact.create / update.',
    blocks: [title('Contacts', 'Interlocuteurs des entreprises de votre périmètre', ['Nouveau contact']), table(['Contact', 'Fonction', 'Entreprise'], [['Alain Fotso', 'DAF', 'Atlas Négoce']], { toolbar: false })],
    modal: {
      title: 'Nouveau contact', w: 700, actions: ['Annuler', 'Enregistrer'],
      blocks: [
        form([['Entreprise *', 'select', 2], ['Nom *'], ['Prénom *'], ['Fonction', 'select'], ['Téléphone'], ['E-mail', 'text', 2]], { cols: 2 }),
        banner('Un contact « Alain Fotso » existe déjà dans Atlas Négoce. Ouvrir la fiche existante ?', 'warn', 'Doublon probable (même entreprise et même nom ou e-mail) : proposer la fiche existante plutôt que bloquer.'),
      ],
    },
    states: ['Erreurs de saisie en surbrillance', 'Entreprise hors portée : non proposée'],
  },
  {
    id: 'offres-liste', title: 'Offres : liste et état', module: 'Business Development', status: 'Proposé', sprint: 'S4.2', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'bd.offer.read ; création : bd.offer.create.',
    blocks: [
      title('Offres', 'Propositions déposées chez les entreprises', ['Nouvelle offre']),
      kpis([['À déposer', '2'], ['Déposées', '7'], ['Décharge reçue', '4'], ['Relances en retard', '1']]),
      table(['Offre', 'Entreprise', 'Montant', 'Statut', 'Prochaine relance'], [['OFF-2026-014', 'Atlas Négoce', '4 500 000 FCFA', '● Déposée', '30/10'], ['OFF-2026-013', 'Sodexim', '2 100 000 FCFA', '● Décharge reçue', '—'], ['OFF-2026-012', 'Banque Horizon', '6 800 000 FCFA', '● Retirée', '—']], { filters: ['Statut'], note: 'États exacts d’une offre à confirmer (brouillon, déposée, décharge reçue, acceptée, refusée, retirée).' }),
    ],
    states: COMMON_STATES,
  },
  {
    id: 'offre-fiche', title: 'Offre : décharge et relances', module: 'Business Development', status: 'Proposé', sprint: 'S4.2', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'bd.offer.*, bd.receipt.*, bd.followup.*.',
    blocks: [
      title('OFF-2026-014', 'Atlas Négoce · 4 500 000 FCFA · déposée le 20/10', ['Retirer l’offre', 'Planifier une relance'], true),
      timeline(['Brouillon', 'Déposée', 'Décharge', 'Relances', 'Réponse'], 1, 'Seules les transitions permises sont proposées ; pas de relance après une décharge refusée ou une offre retirée.'),
      cols([1, 1], [[panel('Décharge', [kv([['Statut', 'Non reçue'], ['Une seule décharge valide par offre', '']], { cols: 1 }), buttons(['Déposer la décharge signée'])], { note: 'Une seule décharge valide par offre (règle métier).' })], [list('Relances', [['1re relance · appel', '30/10'], ['2e relance · e-mail', '06/11']], { note: 'Une relance en retard remonte dans « À faire » et l’agenda.' })]]),
      list('Documents liés', [['Offre commerciale signée.pdf', 'v1'], ['Annexe technique.pdf', 'v1']]),
    ],
    states: ['Offre retirée : lecture seule', 'Décharge refusée', ...COMMON_STATES],
  },
  {
    id: 'decharge-modal', title: 'Dépôt de la décharge signée', module: 'Business Development', status: 'Proposé', sprint: 'S4.2', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'bd.receipt.create.',
    blocks: [title('OFF-2026-014', 'Atlas Négoce · déposée le 20/10', ['Planifier une relance'])],
    modal: { title: 'Déposer la décharge', w: 620, actions: ['Annuler', 'Enregistrer'], blocks: [form([['Date de réception *', 'date'], ['Reçue par'], ['Fichier signé *', 'file', 2], ['Commentaire', 'area', 2]], { cols: 2 }), banner('Seuls les formats autorisés sont acceptés ; le contenu est vérifié, pas seulement l’extension (S3.6).', undefined, 'Réutilise le téléversement de documents (versions, empreinte, antivirus prévu).')] },
    states: ['Fichier refusé (contenu ≠ extension)', 'Décharge déjà valide : action indisponible'],
  },
  {
    id: 'relances', title: 'Relances à faire', module: 'Business Development', status: 'Proposé', sprint: 'S4.2', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'bd.followup.read / complete (Propre ou Équipe).',
    blocks: [
      title('Relances', 'Ce qui est à faire, du plus urgent au moins urgent', ['Planifier une relance']),
      tabs(['À faire (5)', 'En retard (1)', 'Terminées'], 0),
      table(['Relance', 'Entreprise', 'Offre', 'Échéance', 'Canal'], [['Rappeler le DAF', 'Atlas Négoce', 'OFF-2026-014', '● En retard', 'Appel'], ['Envoyer la proposition', 'Sodexim', 'OFF-2026-013', 'Aujourd’hui', 'E-mail'], ['Confirmer la décharge', 'Assur+ Afrique', 'OFF-2026-011', 'Demain', 'WhatsApp']], { note: 'Action rapide « Terminer » avec note ; chaque relance liée à l’agenda.' }),
    ],
    states: COMMON_STATES,
  },
  {
    id: 'agenda-semaine', title: 'Agenda : vue semaine', module: 'Business Development', status: 'Proposé', sprint: 'S4.2b', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'Propre / Équipe / Tous selon le rôle ; agenda partagé : règle d’audience (D60).',
    blocks: [
      title('Agenda', 'Semaine du 26 au 1er novembre', ['Jour', 'Semaine', 'Mois', 'Nouveau rendez-vous']),
      calendar([[0, 1, 2, 'RDV DAF · Atlas'], [1, 3, 1, 'Relance Sodexim'], [2, 0, 1, 'Formation (Investudy)'], [3, 6, 1, 'Visite Investally'], [4, 2, 2, 'RDV décideur · Banque Horizon']], { }),
      banner('Les agendas partagés (équipe, service) suivent une règle d’audience, à décider avec la direction produit.', undefined, 'Vue personnelle par défaut ; vue d’équipe pour le Responsable commercial. Création liée à une entreprise ou une opportunité.'),
    ],
    states: ['Conflit d’horaire signalé', 'Rappels', 'Aucun événement', ...COMMON_STATES],
  },
  {
    id: 'rdv-modal', title: 'Création d’un rendez-vous', module: 'Business Development', status: 'Proposé', sprint: 'S4.2b / S4.3', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'bd.appointment.create.',
    blocks: [title('Agenda', 'Semaine du 26 au 1er novembre', ['Nouveau rendez-vous']), calendar([[1, 2, 2, 'RDV DAF · Atlas']], {})],
    modal: { title: 'Nouveau rendez-vous', w: 700, actions: ['Annuler', 'Enregistrer'], blocks: [form([['Type *', 'select'], ['Entreprise *', 'select'], ['Date *', 'date'], ['Heure *'], ['Contact', 'select'], ['Opportunité liée', 'select'], ['Lieu ou lien', 'text', 2], ['Notes', 'area', 2]], { cols: 2, note: 'Type : RDV DAF ou RDV décideur (le RDV décideur conditionne l’accord de principe).' })] },
    states: ['Conflit d’horaire', 'Contact non rattaché à l’entreprise'],
  },
  {
    id: 'opportunites-cartes', title: 'Opportunités : cartes par six', module: 'Business Development', status: 'Livré', sprint: 'Prototype v0.4.0 ; écran réel : S4.3', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'bd.opportunity.* (Propre, Équipe).',
    blocks: [
      title('Opportunités', 'Parcours de qualification jusqu’à l’accord', ['Par étape', 'Nouvelle opportunité']),
      tabs(['Qualification', 'Proposition', 'Négociation', 'Accord de principe', 'Agrément'], 1, 'Bandeau d’étapes (DEC-003, EXD-04) ; la bascule « Par étape » passe en colonnes.'),
      cards(Array.from({ length: 6 }, (_, i) => [`Atlas Négoce — session ${i + 1}`, '4 500 000 FCFA · Marie N.', i % 2 ? 'Négociation' : 'Proposition']), { cols: 6, h: 112, selected: 2, note: 'Cartes par lignes de six ; sélection persistante.' }),
    ],
    states: ['Vide', 'Alternative clavier de « Par étape » (dette D30)', ...COMMON_STATES],
  },
  {
    id: 'opportunites-etapes', title: 'Opportunités : vue « Par étape »', module: 'Business Development', status: 'Proposé', sprint: 'S4.3', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'bd.opportunity.advance.',
    blocks: [
      title('Opportunités', 'Vue par étape', ['Cartes', 'Nouvelle opportunité']),
      kanban([['Qualification', 3], ['Proposition', 2], ['Négociation', 2], ['Accord de principe', 1], ['Agrément', 1]], 'Alternative clavier obligatoire : menu « Déplacer vers… » sur chaque carte (le glisser-déposer n’est pas la seule voie).'),
    ],
    states: ['Étape refusée (règle du RDV décideur)', ...COMMON_STATES],
  },
  {
    id: 'opportunite-fiche', title: 'Opportunité : fiche et passage d’étape', module: 'Business Development', status: 'Proposé', sprint: 'S4.3', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'bd.opportunity.update / advance / close.',
    blocks: [
      title('Atlas Négoce · session de décembre', '4 500 000 FCFA · propriétaire : Marie Nkoulou', ['Clore', 'Passer à « Accord de principe »'], true),
      timeline(['Qualification', 'Proposition', 'Négociation', 'Accord de principe', 'Agrément'], 2, 'Les étapes se franchissent dans l’ordre ; une opportunité clôturée est immuable.'),
      banner('Accord de principe impossible : aucun rendez-vous décideur tenu. Le Responsable commercial peut accorder une dérogation motivée.', 'warn', 'Règle active avec dérogation justifiée et auditée.'),
      cols([2, 1], [[list('Rendez-vous liés', [['RDV DAF · 22/10 · tenu', ''], ['RDV décideur · 02/11 · planifié', '']])], [list('Offres liées', [['OFF-2026-014', 'Déposée']])]]),
    ],
    states: ['Opportunité clôturée : lecture seule', ...COMMON_STATES],
  },
  {
    id: 'derogation-modal', title: 'Dérogation à la règle du RDV décideur', module: 'Business Development', status: 'Proposé', sprint: 'S4.3', nav: 'BD', role: HOS, user: 'Jean Ekani', rights: 'Dérogation : Responsable commercial uniquement.',
    blocks: [title('Atlas Négoce · session de décembre', '4 500 000 FCFA', ['Passer à « Accord de principe »'])],
    modal: { title: 'Accorder une dérogation', w: 620, actions: ['Annuler', 'Accorder la dérogation'], blocks: [banner('Cette décision est enregistrée dans l’audit avec votre justification.', 'warn', 'Justification obligatoire et auditée ; confirmation de l’action (EXD-13).'), form([['Justification *', 'area', 2]], { cols: 2 })] },
    states: ['Justification vide : bouton désactivé', 'Sans le rôle : action absente'],
  },
  {
    id: 'agrement-fiche', title: 'Agrément (promesse de paiement)', module: 'Business Development', status: 'Proposé', sprint: 'S4.4', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'À confirmer : droits d’agrément (hypothèses de l’architecture).',
    blocks: [
      title('Agrément · Atlas Négoce', 'Promesse de paiement de la formation', ['Annuler l’agrément', 'Marquer comme honoré'], true),
      timeline(['Demandé', 'Reçu', 'Honoré', 'Expiré / annulé'], 1, 'États proposés : demandé → reçu → honoré / expiré / annulé (hypothèse à valider).'),
      panel('Détails', [kv([['Montant', '4 500 000 FCFA'], ['Payeur', 'Atlas Négoce'], ['Places couvertes', '12 (à préciser)'], ['Valide jusqu’au', '30/12/2026'], ['Document signé', 'agrement.pdf']], { cols: 3, note: 'Questions ouvertes : places ou somme globale ? payeur tiers ? expiration ?' })]),
      banner('Sans agrément valide, aucune inscription n’est possible côté Investudy.', undefined, 'Événement envoyé à Investudy à la réception.'),
    ],
    states: ['Agrément expiré : inscriptions non réglées signalées', ...COMMON_STATES],
  },
  {
    id: 'ambassadeurs', title: 'Ambassadeurs', module: 'Business Development', status: 'Proposé', sprint: 'S4.4', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'bd.ambassador.read / create.',
    blocks: [
      title('Ambassadeurs', 'Clients ou apprenants devenus relais commerciaux', ['Nouvel ambassadeur']),
      banner('3 suggestions après certification : créer un ambassadeur reste une décision manuelle.', undefined, 'Suggestion issue de l’événement « certification délivrée » ; jamais de création automatique.'),
      table(['Ambassadeur', 'Origine', 'Entreprise', 'Depuis', 'Actions'], [['Alain Fotso', 'Client', 'Atlas Négoce', '12/2025', '2'], ['Claire Ndzana', 'Apprenante', '—', '03/2026', '1']], { }),
    ],
    states: COMMON_STATES,
  },
  {
    id: 'commissions', title: 'Commissions à verser', module: 'Business Development', status: 'Proposé', sprint: 'Après S4.1 (D54)', nav: 'BD', role: AM, user: 'Marie Nkoulou', rights: 'bd.commission.read (Propre pour le chargé de compte) ; changement d’état : à décider.',
    blocks: [
      title('Commissions', 'Suivi du versement aux facilitateurs', ['Exporter']),
      kpis([['À verser', '3', '1 250 000 FCFA'], ['Fonds débloqués', '2', '750 000 FCFA'], ['Versées ce mois', '5', '2 100 000 FCFA']], 'Procédure : la direction administrative et financière débloque les fonds, le chargé de compte verse (décision du 2026-10-29).'),
      table(['Facilitateur', 'Entreprise', 'Montant', 'État', 'Justificatif'], [['Paul Mbarga', 'Atlas Négoce', '337 500 FCFA', '● À verser', '—'], ['Anne Eto', 'Sodexim', '250 000 FCFA', '● Fonds débloqués', '—'], ['Marc Etoundi', 'Assur+ Afrique', '500 000 FCFA', '● Versée', 'reçu-0042.pdf']], { filters: ['État'], note: 'États envisagés : à verser → fonds débloqués → versée ; reçu ou ordre de versement à préciser avec le DAF.' }),
    ],
    states: ['Aucun versement en attente', ...COMMON_STATES],
  },

  // ───────────────────────────── Investudy ─────────────────────────────
  {
    id: 'catalogue', title: 'Catalogue : programmes et formations', module: 'Investudy', status: 'Proposé', sprint: 'S5.1', nav: 'Investudy', role: 'Responsable Investudy', user: 'Aïcha Bello', rights: 'training.program / training.read ; gestion : TRAINING_MANAGER.',
    blocks: [
      title('Catalogue', 'Programmes et formations', ['Nouveau programme']),
      tabs(['Programmes', 'Formations', 'Salles', 'Formateurs'], 0),
      cards([['Analyse financière — niveau 1', '3 jours · 2 formations', 'Actif'], ['Marchés de capitaux', '5 jours · 1 formation', 'Actif'], ['Gestion des risques', '2 jours', 'Archivé'], ['Produits structurés', '4 jours', 'Actif']], { cols: 4, h: 112, note: 'Programme décliné en formations, planifiées en sessions.' }),
    ],
    states: COMMON_STATES,
  },
  {
    id: 'sessions', title: 'Sessions : calendrier et capacité', module: 'Investudy', status: 'Proposé', sprint: 'S5.2', nav: 'Investudy', role: 'Responsable Investudy', user: 'Aïcha Bello', rights: 'training.session.*.',
    blocks: [
      title('Sessions', 'Occurrences datées avec salle, formateur et capacité', ['Calendrier', 'Nouvelle session']),
      table(['Session', 'Dates', 'Salle', 'Formateur', 'Inscrits', 'État'], [['Analyse financière — N1', '12–14 nov.', 'Salle A', 'D. Nkoulou', '12 / 15', '● Ouverte'], ['Marchés de capitaux', '24–28 nov.', 'Salle B', 'S. Mballa', '15 / 15', '● Complète'], ['Gestion des risques', '03–04 déc.', 'Salle A', 'D. Nkoulou', '4 / 15', '● Planifiée']], { filters: ['État', 'Salle'], note: 'Pas de double réservation salle ou formateur ; inscrits ≤ capacité (règles du domaine).' }),
    ],
    states: ['Conflit salle ou formateur', ...COMMON_STATES],
  },
  {
    id: 'session-detail', title: 'Session : inscrits, présences, évaluations', module: 'Investudy', status: 'Proposé', sprint: 'S5.2 / S5.3', nav: 'Investudy', role: 'Formateur / Responsable Investudy', user: 'D. Nkoulou', rights: 'Formateur : ses sessions (Propre) ; gestion : Responsable Investudy.',
    blocks: [
      title('Analyse financière — niveau 1', '12–14 novembre · Salle A · formateur D. Nkoulou', ['Clôturer la session', 'Ajouter un inscrit'], true),
      kpis([['Inscrits', '12 / 15'], ['Présence moyenne', '92 %'], ['Évaluations saisies', '8 / 12'], ['Agrément', 'Valide', 'jusqu’au 30/12']]),
      tabs(['Inscrits', 'Présences', 'Évaluations', 'Documents'], 0),
      table(['Apprenant', 'Entreprise', 'Agrément', 'Inscription', 'Paiement'], [['Alain Fotso', 'Atlas Négoce', 'Valide', '● Confirmée', 'En attente'], ['Claire Ndzana', 'Atlas Négoce', 'Valide', '● Confirmée', 'Réglé']], { note: 'Session clôturée : présences figées.' }),
    ],
    states: ['Session complète : liste d’attente à décider', 'Session clôturée', ...COMMON_STATES],
  },
  {
    id: 'apprenants', title: 'Apprenants', module: 'Investudy', status: 'Proposé', sprint: 'S5.2', nav: 'Investudy', role: 'Responsable Investudy', user: 'Aïcha Bello', rights: 'training.learner.read / create / update.',
    blocks: [
      title('Apprenants', 'Personnes suivant une formation (aucun compte, aucun accès à l’application)', ['Nouvel apprenant']),
      banner('Un apprenant n’a ni compte ni portail : c’est une fiche saisie par le personnel.', undefined, 'Entité distincte du contact ; lien facultatif.'),
      table(['Apprenant', 'Entreprise', 'Formations suivies', 'Certifications', 'Contact lié'], [['Alain Fotso', 'Atlas Négoce', '3', '2', 'Oui'], ['Claire Ndzana', 'Atlas Négoce', '1', '1', 'Oui'], ['Marc Etoundi', 'Assur+ Afrique', '2', '0', 'Non']], { filters: ['Entreprise'] }),
    ],
    states: COMMON_STATES,
  },
  {
    id: 'inscription-modal', title: 'Inscription d’un apprenant à une session', module: 'Investudy', status: 'Proposé', sprint: 'S5.2', nav: 'Investudy', role: AM, user: 'Marie Nkoulou', rights: 'training.enrollment.create (Propre).',
    blocks: [title('Sessions', 'Analyse financière — niveau 1', ['Ajouter un inscrit'])],
    modal: { title: 'Inscrire un apprenant', w: 700, actions: ['Annuler', 'Inscrire'], blocks: [form([['Session *', 'select', 2], ['Apprenant *', 'select'], ['Agrément *', 'select'], ['Prise en charge', 'select'], ['Commentaire', 'area']], { cols: 2 }), banner('Sans agrément valide, l’inscription est refusée. Le cumul des inscriptions ne peut dépasser l’agrément.', 'warn', 'Règle du domaine Investudy (reçue de Business Development).')] },
    states: ['Agrément absent ou expiré', 'Session complète', 'Apprenant déjà inscrit'],
  },
  {
    id: 'presences', title: 'Feuille de présence', module: 'Investudy', status: 'Proposé', sprint: 'S5.3', nav: 'Investudy', role: 'Formateur', user: 'D. Nkoulou', rights: 'training.attendance.record (ses sessions).',
    blocks: [
      title('Présences · jour 2', 'Analyse financière — niveau 1 · 13 novembre', ['Imprimer la feuille d’émargement', 'Enregistrer']),
      table(['Apprenant', 'Matin', 'Après-midi', 'Retard', 'Observation'], [['Alain Fotso', '☑', '☑', '—', ''], ['Claire Ndzana', '☑', '☐', '—', 'Départ anticipé'], ['Marc Etoundi', '☐', '☐', '—', 'Absent excusé']], { select: false, note: 'Saisie rapide au clavier ; la feuille d’émargement est un document de la charte.' }),
    ],
    states: ['Session clôturée : figée', ...COMMON_STATES],
  },
  {
    id: 'certifications', title: 'Certifications et attestations', module: 'Investudy', status: 'Proposé', sprint: 'S5.3', nav: 'Investudy', role: 'Responsable Investudy', user: 'Aïcha Bello', rights: 'training.certification.issue / revoke.',
    blocks: [
      title('Certifications', 'Certificats de réussite et attestations de suivi', ['Délivrer une certification']),
      tabs(['À délivrer (4)', 'Délivrées', 'Révoquées'], 0),
      table(['Apprenant', 'Formation', 'Résultat', 'Type', 'Ambassadeur ?'], [['Alain Fotso', 'Analyse financière N1', '16 / 20', '● Certificat', 'Suggérer'], ['Claire Ndzana', 'Marchés de capitaux', 'Présente', '● Attestation', '—']], { note: 'La délivrance déclenche une suggestion d’ambassadeur au chargé de compte (jamais automatique) ; le document suit la charte.' }),
    ],
    states: ['Révocation : confirmation et justification', ...COMMON_STATES],
  },

  // ───────────────────────────── Reporting ─────────────────────────────
  {
    id: 'dashboard-compte', title: 'Tableau de bord : chargé de compte', module: 'Reporting', status: 'Proposé', sprint: 'S6.1', nav: 'Reporting', role: AM, user: 'Marie Nkoulou', rights: 'reporting.dashboard.account_manager (Propre).',
    blocks: [
      title('Mon tableau de bord', 'Mes entreprises, offres et relances', ['Exporter']),
      kpis([['Entreprises', '24'], ['Opportunités ouvertes', '6'], ['Offres déposées', '7'], ['Relances en retard', '1']], 'Chaque indicateur ouvre la liste correspondante, filtrée.'),
      cols([2, 1], [[chart('Opportunités par étape', 'bars')], [chart('Répartition par statut', 'donut')]]),
      list('Mes priorités', [['Relancer Atlas Négoce', 'En retard'], ['Verser la commission Banque Horizon', 'Fonds débloqués']]),
    ],
    states: ['Aucune donnée sur la période', ...COMMON_STATES],
  },
  {
    id: 'dashboard-commercial', title: 'Tableau de bord : Responsable commercial', module: 'Reporting', status: 'Proposé', sprint: 'S6.1', nav: 'Reporting', role: HOS, user: 'Jean Ekani', rights: 'reporting.dashboard.head_of_sales (Équipe ou Tous).',
    blocks: [
      title('Pipeline de l’équipe', 'Vue d’ensemble commerciale', ['Période : 30 jours', 'Exporter']),
      kpis([['Pipeline', '48 600 000 FCFA'], ['Taux de transformation', '22 %'], ['Dérogations accordées', '2'], ['Commissions à valider', '3']]),
      cols([1, 1], [[chart('Pipeline par chargé de compte', 'bars')], [chart('Évolution mensuelle', 'line')]]),
      table(['Chargé de compte', 'Entreprises', 'Opportunités', 'Offres', 'Relances en retard'], [['Marie Nkoulou', '24', '6', '7', '1'], ['Paul Atangana', '18', '4', '5', '0']], { toolbar: false, select: false }),
    ],
    states: COMMON_STATES,
  },
  {
    id: 'dashboard-direction', title: 'Tableau de bord : Direction', module: 'Reporting', status: 'Proposé', sprint: 'S6.1 / S6.2', nav: 'Reporting', role: 'Direction (DG, DGA)', user: 'Direction', rights: 'reporting.dashboard.direction (Tous) ; export tracé.',
    blocks: [
      title('Direction : vue stratégique', 'Investally et Investudy', ['Mois', 'Exporter']),
      kpis([['Chiffre d’affaires du mois', '12 400 000 FCFA'], ['Clients actifs', '38'], ['Sessions ouvertes', '5'], ['Incidents ouverts', '2']]),
      cols([1, 1, 1], [[chart('Chiffre d’affaires', 'line', { h: 200 })], [chart('Formés par mois', 'bars', { h: 200 })], [chart('Sources des affaires', 'donut', { h: 200 })]]),
    ],
    states: ['Indicateurs de performance des employés : seulement après avis juridique et RH', ...COMMON_STATES],
  },
  {
    id: 'dashboard-investudy', title: 'Tableau de bord : Investudy', module: 'Reporting', status: 'Proposé', sprint: 'S6.2', nav: 'Reporting', role: 'Responsable Investudy', user: 'Aïcha Bello', rights: 'reporting.dashboard.training.',
    blocks: [
      title('Investudy', 'Remplissage, présence et certification', ['Période : trimestre', 'Exporter']),
      kpis([['Taux de remplissage', '81 %'], ['Présence moyenne', '92 %'], ['Certifiés', '34'], ['Agréments à honorer', '4']]),
      cols([1, 1], [[chart('Inscrits par session', 'bars')], [chart('Résultats aux évaluations', 'line')]]),
    ],
    states: COMMON_STATES,
  },
  {
    id: 'rapports-employes', title: 'Rapports des employés (vue partagée)', module: 'Reporting', status: 'Proposé', sprint: 'S6.3', nav: 'Reporting', role: 'Tout employé (audience à définir)', user: 'Marie Nkoulou', rights: 'Vue partagée : audience (tous, service, équipe) plutôt que portée par propriétaire (D60).',
    blocks: [
      title('Rapports', 'Rapports journaliers, hebdomadaires et mensuels', ['Nouveau rapport']),
      tabs(['Journaliers', 'Hebdomadaires', 'Mensuels'], 0, 'Vue partagée : chacun rédige le sien ; l’audience qui le lit reste à décider. Le suivi des performances n’est livré qu’après avis juridique et RH.'),
      table(['Rapport', 'Auteur', 'Service', 'Date', 'État'], [['Journalier 29/10', 'Marie Nkoulou', 'Commercial', '29/10/2026', '● Envoyé'], ['Journalier 29/10', 'Paul Atangana', 'Commercial', '29/10/2026', '● Brouillon'], ['Journalier 28/10', 'Aïcha Bello', 'Investudy', '28/10/2026', '● Envoyé']], { filters: ['Service', 'Auteur'], note: 'Export : même règle que partout (lecture = export, trace) ; contenu sensible à protéger.' }),
    ],
    states: ['Audience non autorisée : vue absente', 'Brouillon', ...COMMON_STATES],
  },
  {
    id: 'incidents', title: 'Incidents (opérationnels et sécurité)', module: 'Reporting', status: 'Proposé', sprint: 'S6.3', nav: 'Reporting', role: 'Tout employé / Responsables', user: 'Marie Nkoulou', rights: 'Déclaration : tous ; traitement : responsables ; sécurité : Super administrateur.',
    blocks: [
      title('Incidents', 'Déclaration et suivi', ['Déclarer un incident']),
      table(['Incident', 'Catégorie', 'Gravité', 'Déclaré par', 'État'], [['Salle B indisponible', 'Opérationnel', '● Moyenne', 'D. Nkoulou', '● En cours'], ['Connexion suspecte', 'Sécurité', '● Élevée', 'Système', '● Ouvert']], { filters: ['Catégorie', 'État'], note: 'Catégories à confirmer (question ouverte du cadrage).' }),
    ],
    states: COMMON_STATES,
  },

  // ───────────────────────────── Stocks ─────────────────────────────
  {
    id: 'stock-articles', title: 'Stocks : articles et seuils', module: 'Stocks', status: 'Proposé', sprint: 'ST', nav: 'Stocks', role: 'Gestionnaire de stock (rôle à créer)', user: 'À définir', rights: 'Rôle Logistique à confirmer (question ouverte).',
    blocks: [
      title('Articles', 'Catégories, fournisseurs et seuils d’alerte', ['Nouvel article']),
      kpis([['Articles', '84'], ['Sous le seuil', '6'], ['Mouvements du mois', '132']]),
      table(['Article', 'Catégorie', 'Fournisseur', 'En stock', 'Seuil'], [['Ramette A4', 'Papeterie', 'Papyrus SA', '12', '● 20'], ['Cartouche encre', 'Informatique', 'Tech+', '4', '● 5'], ['Badge visiteur', 'Accueil', 'PrintCam', '210', '50']], { filters: ['Catégorie'], note: 'Module autonome hébergé dans le CRM, extractible vers l’ERP (ADR-0007).' }),
    ],
    states: ['Sous le seuil : alerte', ...COMMON_STATES],
  },
  {
    id: 'stock-mouvements', title: 'Stocks : mouvements et inventaire', module: 'Stocks', status: 'Proposé', sprint: 'ST', nav: 'Stocks', role: 'Gestionnaire de stock', user: 'À définir', rights: 'Mouvements immuables ; correction par un mouvement inverse.',
    blocks: [
      title('Mouvements', 'Entrées, sorties et inventaire', ['Inventaire', 'Nouveau mouvement']),
      table(['Date', 'Type', 'Article', 'Quantité', 'Opérateur'], [['29/10', '● Sortie', 'Ramette A4', '−5', 'Marie N.'], ['28/10', '● Entrée', 'Cartouche encre', '+10', 'Gestionnaire'], ['25/10', '● Inventaire', 'Badge visiteur', '210', 'Gestionnaire']], { filters: ['Type', 'Article'], note: 'Aucune suppression : un mouvement s’annule par un mouvement inverse tracé.' }),
    ],
    states: COMMON_STATES,
  },

  // ───────────────────────────── Finance ─────────────────────────────
  {
    id: 'factures', title: 'Facturation : liste', module: 'Finance', status: 'Proposé', sprint: 'ERP (Finance)', nav: 'Finance', role: 'Finance / DAF', user: 'DAF', rights: 'Documents financiers : le DAF exporte les siens, avec trace.',
    blocks: [
      title('Factures', 'Devis, factures, avoirs et reçus', ['Nouvelle facture']),
      kpis([['À encaisser', '6 797 250 FCFA'], ['En retard', '1'], ['Émises ce mois', '14']]),
      table(['N°', 'Client', 'Échéance', 'Total TTC', 'État'], [['FAC-2026-0042', 'Atlas Négoce', '28/11/2026', '6 797 250 FCFA', '● À payer'], ['FAC-2026-0041', 'Sodexim', '15/11/2026', '2 508 000 FCFA', '● Payée'], ['FAC-2026-0039', 'Banque Horizon', '20/10/2026', '4 200 000 FCFA', '● En retard']], { filters: ['État'], note: 'Une facture émise est immuable : correction par un avoir ; numérotation et mentions validées avec le DAF.' }),
    ],
    states: COMMON_STATES,
  },
  {
    id: 'facture-document', title: 'Document : facture (charte)', module: 'Finance', status: 'Proposé', sprint: 'Charte des documents', nav: 'Finance', role: 'Finance / DAF', user: 'DAF', rights: 'Export : DAF et personnes autorisées, tracé.',
    blocks: [
      title('Facture FAC-2026-0042', 'Aperçu du document', ['Télécharger', 'Envoyer'], true),
      panel(null, [
        cols([2, 1], [[{ t: 'title', text: 'Investally Group', sub: 'Douala, Cameroun' }], [{ t: 'title', text: 'FACTURE', sub: 'N° FAC-2026-0042 · ● À payer' }]]),
        cols([1, 1], [[kv([['Facturé à', 'Atlas Négoce'], ['À l’attention de', 'Direction financière']], { cols: 1 })], [kv([['Date d’émission', '29 octobre 2026'], ['Échéance', '28 novembre 2026'], ['Référence', 'Session 12–14 nov.']], { cols: 1 })]]),
        table(['Description', 'Qté', 'Prix unitaire (XAF)', 'Total (XAF)'], [['Formation « Analyse financière — niveau 1 »', '1', '4 500 000', '4 500 000'], ['Accès à la plateforme Investudy', '12', '75 000', '900 000'], ['Supports pédagogiques', '12', '25 000', '300 000']], { toolbar: false, select: false, pager: false, footer: 'Sous-total HT 5 700 000 · TVA 19,25 % 1 097 250 · Total TTC 6 797 250 XAF' }),
        kv([['Modalités', 'Virement à 30 jours'], ['Banque', '[à renseigner par le DAF]'], ['Mentions légales', 'RCCM, NIU, capital : à fournir']], { cols: 3 }),
      ], { note: 'Reprend la maquette validée ; mentions légales, numérotation et TVA à confirmer avec le DAF avant d’émettre un vrai document.' }),
    ],
    states: ['Brouillon (non numéroté)', 'Annulée par un avoir', 'PDF accessible (balisage)'],
  },

  // ───────────────────────────── RH et fiscalité ─────────────────────────────
  {
    id: 'conges', title: 'Congés : demandes et soldes', module: 'RH et fiscalité', status: 'Proposé', sprint: 'ERP (RH)', nav: 'RH', role: 'Employé / RH', user: 'Marie Nkoulou', rights: 'Employé : ses demandes ; RH : tout ; responsable : son équipe.',
    blocks: [
      title('Congés', 'Mes demandes et mon solde', ['Nouvelle demande']),
      kpis([['Solde', '12 jours'], ['Pris cette année', '8 jours'], ['En attente', '1 demande']]),
      table(['Période', 'Type', 'Durée', 'Validateur', 'État'], [['10–14 nov.', 'Annuel', '5 j', 'J. Ekani', '● En attente'], ['02–06 août', 'Annuel', '5 j', 'J. Ekani', '● Validé']], { select: false, note: 'Règles : solde suffisant, pas de chevauchement ; absence visible dans l’agenda d’équipe selon l’audience.' }),
    ],
    states: COMMON_STATES,
  },
  {
    id: 'echeances-fiscales', title: 'Échéances fiscales', module: 'RH et fiscalité', status: 'Proposé', sprint: 'ERP (Fiscalité)', nav: 'RH', role: 'Fiscalité / DAF', user: 'Fiscalité', rights: 'Rôle Fiscalité ; export tracé.',
    blocks: [
      title('Échéances fiscales', 'Déclarations et dates limites', ['Nouvelle échéance']),
      table(['Déclaration', 'Période', 'Date limite', 'Responsable', 'État'], [['TVA', 'Octobre', '15/11/2026', 'Fiscalité', '● À préparer'], ['CNPS', 'Octobre', '15/11/2026', 'RH', '● À préparer'], ['Acompte IS', 'T3', '15/10/2026', 'Fiscalité', '● Déposée']], { filters: ['Déclaration', 'État'], note: 'Rappels dans l’agenda ; pièces jointes via les documents.' }),
    ],
    states: COMMON_STATES,
  },

  // ───────────────────────────── Administration ─────────────────────────────
  {
    id: 'audit', title: 'Journal d’audit', module: 'Administration', status: 'Proposé', sprint: 'S6.2 / S7.2', nav: 'Admin', role: 'Direction / Super administrateur', user: 'Direction', rights: 'audit.log.read (Tous) ; export : audit.log.export, tracé.',
    blocks: [
      title('Journal d’audit', 'Qui a fait quoi, quand, depuis où', ['Exporter']),
      table(['Date', 'Utilisateur', 'Action', 'Objet', 'Session', 'Adresse'], [['29/10 14:02', 'Marie N.', 'Export', 'Entreprise · Atlas Négoce', 's-42', '10.0.0.9'], ['29/10 11:15', 'Jean E.', 'Modification', 'Entreprise · Sodexim', 's-37', '10.0.0.4'], ['28/10 17:40', 'Admin', 'Changement de rôle', 'Utilisateur · Marie N.', 's-12', '127.0.0.1']], { filters: ['Action', 'Utilisateur', 'Période'], note: 'Journal en ajout seul ; conservation 10 ans ; chaque export est lui-même tracé.' }),
    ],
    states: ['Aucune entrée sur la période', ...COMMON_STATES],
  },
];
