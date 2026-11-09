import { phoneProblem } from '../../modules/business-development/domain/contact-info';
import { blockOf, buildPlan, COMPANIES, isDemoPhone, SEED_BLOCKS, SeedEvent, SeedOp } from './seed-plan';

const anchor = new Date('2026-11-03T12:00:00Z');
const plan = buildPlan({ anchor });
const isoDayPlus = (iso: string, days: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const ofKind = <K extends SeedOp['k']>(k: K) => plan.filter((e) => e.op.k === k).map((e) => e.op as Extract<SeedOp, { k: K }>);
const dayDiff = (iso: string) => Math.round((new Date(iso).getTime() - anchor.getTime()) / 86_400_000);

describe('plan du jeu de données de démonstration', () => {
  it('est déterministe : mêmes entrées, mêmes événements', () => {
    expect(JSON.stringify(buildPlan({ anchor }))).toBe(JSON.stringify(buildPlan({ anchor })));
    expect(JSON.stringify(buildPlan({ anchor, seed: 7 }))).not.toBe(JSON.stringify(buildPlan({ anchor })));
  });

  it('couvre quarante entreprises fictives, aux noms uniques, de tous les secteurs demandés', () => {
    expect(COMPANIES).toHaveLength(40);
    expect(new Set(COMPANIES.map((c) => c.name)).size).toBe(40);
    const text = COMPANIES.map((c) => c.sector).join(' | ');
    for (const sector of ['Banque', 'Fintech', 'Assurance', 'Gestion de patrimoine', 'Société de bourse', 'Télécoms', 'Industrie', '(PME)']) expect(text).toContain(sector);
    expect(ofKind('company').length).toBeGreaterThanOrEqual(38);
  });

  it('est chronologique et ne contient aucun événement dans le futur', () => {
    const times = plan.map((e) => e.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(Math.max(...times)).toBeLessThanOrEqual(anchor.getTime());
  });

  it('répartit la vie des entreprises sur douze mois', () => {
    const first = Math.min(...plan.map((e) => e.at.getTime()));
    expect((anchor.getTime() - first) / 86_400_000).toBeGreaterThan(330);
  });

  it('ne contient que des numéros valides selon la règle de l’application, tous du motif fictif', () => {
    const phones = plan.flatMap((e) => {
      const op = e.op;
      const own = 'phone' in op && op.phone ? [op.phone] : [];
      const facilitator = op.k === 'company' && op.facilitator ? [op.facilitator.phone] : [];
      return [...own, ...facilitator];
    });
    expect(phones.length).toBeGreaterThan(100);
    for (const phone of phones) {
      expect([phone, phoneProblem(phone)]).toEqual([phone, null]);
      expect([phone, isDemoPhone(phone)]).toEqual([phone, true]);
    }
  });

  it('n’emploie que des adresses e-mail en « .test » (domaine réservé, jamais joignable), uniques par personne', () => {
    const emails = plan.flatMap((e) => ('email' in e.op && e.op.email ? [e.op.email] : []));
    for (const email of emails) expect(email).toMatch(/\.test$/);
    const personal = [...ofKind('contact'), ...ofKind('ambassador')].map((o) => o.email);
    expect(new Set(personal).size).toBe(personal.length);
  });

  it('respecte l’ordre des dépendances : chaque objet est créé avant d’être utilisé', () => {
    const created = new Set<string>();
    const need = (key: string, what: string) => expect([what, key, created.has(key)]).toEqual([what, key, true]);
    for (const { op } of plan) {
      switch (op.k) {
        case 'company': created.add(op.key); if (op.facilitator) created.add(op.facilitator.key); break;
        case 'companyFacilitator': need(op.key, 'entreprise'); need(op.facilitatorKey, 'facilitateur'); break;
        case 'commission': case 'companyStatus': need(op.company, 'entreprise'); break;
        case 'contact': need(op.company, 'entreprise'); created.add(op.key); break;
        case 'offer': need(op.company, 'entreprise'); created.add(op.key); break;
        case 'offerAction': case 'receipt': case 'receiptCancel': need(op.offer, 'offre'); break;
        case 'reassign': need(op.company, 'entreprise'); break;
        case 'payout': need(op.approval, 'agrément'); break;
        case 'ambassadorUpdate': need(op.ambassador, 'ambassadeur'); break;
        case 'followupPlan': need(op.offer, 'offre'); created.add(op.key); break;
        case 'followupClose': need(op.followup, 'relance'); break;
        case 'appointment': need(op.company, 'entreprise'); if (op.contact) need(op.contact, 'contact'); if (op.opportunity) need(op.opportunity, 'opportunité'); created.add(op.key); break;
        case 'appointmentTransition': need(op.appointment, 'rendez-vous'); break;
        case 'opportunity': need(op.company, 'entreprise'); created.add(op.key); break;
        case 'advance': case 'waiver': case 'close': need(op.opportunity, 'opportunité'); break;
        case 'approval': need(op.opportunity, 'opportunité'); created.add(op.key); break;
        case 'approvalReceive': case 'approvalClose': need(op.approval, 'agrément'); break;
        case 'ambassador': if (op.company) need(op.company, 'entreprise'); created.add(op.key); break;
        case 'program': case 'module': case 'room': created.add(op.key); break;
        case 'training': need(op.program, 'programme'); op.modules.forEach((m) => need(m, 'module')); created.add(op.key); break;
      }
    }
  });

  it('couvre tous les états métier : offres, relances, rendez-vous, opportunités, agréments, ambassadeurs', () => {
    const actions = new Set(ofKind('offerAction').map((o) => o.action));
    for (const action of ['submit', 'accept', 'refuse', 'withdraw'] as const) expect(actions.has(action)).toBe(true);
    expect(ofKind('receipt').length).toBeGreaterThan(5);
    const plans = ofKind('followupPlan');
    const closed = new Set(ofKind('followupClose').map((o) => o.followup));
    expect(plans.some((p) => closed.has(p.key))).toBe(true); // faite
    expect(plans.some((p) => !closed.has(p.key) && dayDiff(p.dueOn) < 0)).toBe(true); // en retard
    expect(plans.some((p) => dayDiff(p.dueOn) > 0)).toBe(true); // à venir
    expect(ofKind('appointmentTransition').some((o) => o.transition === 'hold')).toBe(true);
    expect(ofKind('appointment').some((o) => dayDiff(o.startsAt) > 0)).toBe(true); // à venir
    expect(ofKind('appointment').map((o) => o.type)).toEqual(expect.arrayContaining(['FINANCE_DIRECTOR', 'DECISION_MAKER']));
    expect(ofKind('close').map((o) => o.outcome)).toEqual(expect.arrayContaining(['lost', 'won']));
    expect(ofKind('waiver').length).toBeGreaterThan(0);
    const approvals = ofKind('approval');
    expect(approvals.some((a) => a.requested)).toBe(true);
    expect(approvals.some((a) => a.payerName && a.payerType)).toBe(true);
    expect(approvals.some((a) => !a.payerName)).toBe(true);
    const closes = new Set(ofKind('approvalClose').map((o) => o.action));
    expect(closes.has('honor')).toBe(true);
    expect(closes.has('expire')).toBe(true);
    expect(closes.has('cancel')).toBe(true);
    expect(ofKind('appointmentTransition').some((o) => o.transition === 'cancel')).toBe(true);
    expect(ofKind('approvalReceive').length).toBeGreaterThan(0);
    expect(ofKind('ambassador').map((a) => a.origin)).toEqual(expect.arrayContaining(['CLIENT', 'LEARNER']));
    expect(ofKind('contact').map((c) => c.role)).toEqual(expect.arrayContaining(['FINANCE_DIRECTOR', 'DECISION_MAKER', 'OTHER']));
    expect(ofKind('companyStatus').map((c) => c.status)).toEqual(expect.arrayContaining(['CONTACTED', 'QUALIFIED']));
  });

  it('prévoit des commissions dues, débloquées, en attente et annulées (flux F3)', () => {
    const payouts = ofKind('payout');
    expect(payouts.map((p) => p.action).sort()).toEqual(['cancel', 'hold', 'release']);
    expect(plan.filter((e) => e.op.k === 'payout' && (e.op.action === 'release' || e.op.action === 'hold')).every((e) => e.who === 'finance')).toBe(true);
    expect(plan.filter((e) => e.op.k === 'payout' && e.op.action === 'cancel').every((e) => e.who === 'commercial')).toBe(true);
    // Chaque agrément honoré d'une entreprise commissionnée a son facilitateur et sa commission définis avant l'honneur.
    const honored = plan.filter((e) => e.op.k === 'approvalClose' && e.op.action === 'honor').length;
    expect(honored).toBeGreaterThanOrEqual(3);
  });

  it('enrichit l’agenda, les relances, les contacts et les ambassadeurs (observations de recette)', () => {
    const upcoming = ofKind('appointment').filter((o) => dayDiff(o.startsAt) > 0);
    expect(upcoming.length).toBeGreaterThanOrEqual(6);
    expect(new Set(upcoming.map((o) => o.type)).size).toBe(3);
    expect(ofKind('appointmentTransition').filter((o) => o.transition === 'postpone').length).toBeGreaterThanOrEqual(3);
    expect(ofKind('appointmentTransition').some((o) => o.transition === 'postpone' && o.startsAt && dayDiff(o.startsAt) > 0)).toBe(true);
    const plans = ofKind('followupPlan');
    expect(plans.filter((p) => dayDiff(p.dueOn) > 0).length).toBeGreaterThanOrEqual(6);
    expect(plans.filter((p) => dayDiff(p.dueOn) < 0).length).toBeGreaterThanOrEqual(2);
    expect(ofKind('followupClose').some((c) => c.closing === 'cancel')).toBe(true);
    const perOffer = new Map<string, number>();
    for (const p of plans) perOffer.set(p.offer, (perOffer.get(p.offer) ?? 0) + 1);
    expect(Math.max(...perOffer.values())).toBeGreaterThanOrEqual(2);
    expect(Math.max(...perOffer.values())).toBeLessThanOrEqual(3); // la règle : trois relances au plus par offre
    expect(ofKind('receiptCancel').length).toBeGreaterThan(0);
    const contacts = ofKind('contact');
    const names = new Map<string, number>();
    for (const c of contacts) names.set(`${c.company}|${c.firstName}|${c.lastName}`, (names.get(`${c.company}|${c.firstName}|${c.lastName}`) ?? 0) + 1);
    expect([...names.values()].filter((n) => n > 1).length).toBeGreaterThanOrEqual(3); // doublons probables
    expect(contacts.filter((c) => c.role === 'OTHER').length).toBeGreaterThanOrEqual(15);
    expect(ofKind('ambassadorUpdate').length).toBeGreaterThanOrEqual(2);
    expect(ofKind('reassign').length).toBeGreaterThanOrEqual(3);
  });

  it('une entreprise réattribuée n’a plus d’événement du chargé de compte d’origine après sa réattribution', () => {
    const reassigned = plan.filter((e) => e.op.k === 'reassign');
    for (const event of reassigned) {
      const key = (event.op as { company: string }).company;
      const later = plan.filter((e) => e.at.getTime() > event.at.getTime() && e.who !== 'commercial' && e.who !== 'finance'
        && Object.values(e.op).some((v) => typeof v === 'string' && v.startsWith(`${key}`)));
      expect([key, later.length]).toEqual([key, 0]);
    }
  });

  it('répartit les entreprises entre les trois chargés de compte, et réserve ce qui est réservé', () => {
    const owners = new Set(plan.filter((e) => e.op.k === 'company').map((e) => e.who));
    expect([...owners].sort()).toEqual(['compte1', 'compte2', 'compte3']);
    expect(plan.filter((e) => e.op.k === 'waiver').every((e) => e.who === 'commercial')).toBe(true);
    expect(plan.filter((e) => e.op.k === 'close' && e.op.outcome === 'won').every((e) => e.who === 'commercial')).toBe(true);
    expect(plan.filter((e) => e.op.k === 'approvalClose' && e.op.action === 'honor').every((e) => e.who === 'finance')).toBe(true);
  });

  it('suit les règles du métier : un agrément honoré a d’abord été reçu ; une opportunité gagnée a franchi l’accord de principe', () => {
    const received = new Map<string, number>();
    const stages = new Map<string, number>();
    const waivers = new Set<string>();
    plan.forEach((e: SeedEvent) => {
      const op = e.op;
      if (op.k === 'approval') received.set(op.key, op.requested ? Infinity : e.at.getTime());
      if (op.k === 'approvalReceive') received.set(op.approval, e.at.getTime());
      if (op.k === 'approvalClose' && op.action === 'honor') expect(received.get(op.approval)).toBeLessThanOrEqual(e.at.getTime());
      if (op.k === 'advance') stages.set(op.opportunity, (stages.get(op.opportunity) ?? 0) + 1);
      if (op.k === 'waiver') waivers.add(op.opportunity);
      if (op.k === 'approval') expect(stages.get(op.opportunity) ?? 0).toBeGreaterThanOrEqual(3);
      if (op.k === 'close' && op.outcome === 'won') expect(stages.get(op.opportunity) ?? 0).toBeGreaterThanOrEqual(3);
    });
    expect(waivers.size).toBeGreaterThan(0);
  });

  it('contient le catalogue Investudy : cinq certificats bâtis sur sept modules partagés, leurs tarifs et la salle de marchés', () => {
    const certificates = ofKind('training');
    expect(ofKind('program')).toHaveLength(1);
    expect(ofKind('module')).toHaveLength(7);
    expect(certificates.map((c) => [c.key, c.modules.length, c.priceAmount, c.modulePriceAmount])).toEqual([
      ['expert', 7, '750000', '125000'], ['etudiants', 5, '250000', '75000'], ['dirigeants', 5, '500000', '125000'], ['avocats', 4, '500000', '125000'], ['banque', 5, '500000', '125000'],
    ]);
    // Un module est partagé par plusieurs certificats ; aucun certificat n'en répète un.
    for (const c of certificates) expect(new Set(c.modules).size).toBe(c.modules.length);
    expect(certificates.filter((c) => c.modules.includes('m1'))).toHaveLength(5);
    const [room, meeting] = [ofKind('room')[0]!, ofKind('room')[1]!];
    expect([room.kind, room.learnerSeats, room.unavailableSeats, room.trainerSeats]).toEqual(['WORKSTATIONS', 14, 1, 1]);
    expect([meeting.kind, meeting.learnerSeats, meeting.trainerSeats]).toEqual(['CLASSROOM', 16, 0]);
    expect(ofKind('module').filter((m) => m.requiresWorkstations).map((m) => m.key)).toEqual(['m4', 'm7']);
    expect(plan.filter((e) => ['program', 'module', 'training', 'room'].includes(e.op.k)).every((e) => e.at.getTime() < anchor.getTime())).toBe(true);
  });

  it('contient cinq formateurs externes fictifs, aux e-mails uniques en « .test » ; le plan se partage en trois blocs', () => {
    const trainers = ofKind('trainer');
    expect(trainers).toHaveLength(5);
    expect(new Set(trainers.map((t) => t.email)).size).toBe(5);
    for (const t of trainers) expect(t.email).toMatch(/@formateurs\.investudy\.test$/);
    // Chaque événement appartient à un bloc, et les trois blocs sont tous présents : un bloc se charge seul sur une démo existante.
    const byBlock = new Map<string, number>();
    for (const e of plan) byBlock.set(blockOf(e.op), (byBlock.get(blockOf(e.op)) ?? 0) + 1);
    expect([...byBlock.keys()].sort()).toEqual([...SEED_BLOCKS].sort());
    expect(byBlock.get('formateurs')).toBe(5);
    expect(byBlock.get('catalogue')).toBe(1 + 7 + 5 + 2);
    expect(byBlock.get('sessions')).toBe(7 + 5 + 1 + 1); // sept sessions, cinq ouvertures, un report, une annulation
    // cinq entreprises clientes (7 opérations chacune), douze apprenants, quatorze inscriptions, dix confirmations, une annulation, un replacement
    expect(byBlock.get('inscriptions')).toBe(5 * 7 + 12 + 14 + 10 + 1 + 1);
    // Aucun bloc ne dépend d'un objet d'un autre : le catalogue et les formateurs n'utilisent que leurs propres clés.
    const keysOf = (block: string) => new Set(plan.filter((e) => blockOf(e.op) === block && 'key' in e.op).map((e) => (e.op as { key: string }).key));
    const catalogueKeys = keysOf('catalogue');
    for (const e of plan) {
      if (e.op.k === 'training') {
        expect(catalogueKeys.has(e.op.program)).toBe(true);
        for (const m of e.op.modules) expect(catalogueKeys.has(m)).toBe(true);
      }
    }
  });

  it('planifie sept sessions sans chevauchement, un jour de cours, dans la salle de marchés, avec leur histoire (terminées, en cours, ouverte, planifiée, reportée, annulée)', () => {
    const sessions = ofKind('session');
    expect(sessions).toHaveLength(7);
    for (const s of sessions) {
      expect([s.key, s.room]).toEqual([s.key, 'Salle de marchés']);
      expect([s.key, [1, 2, 3, 4, 5].includes(new Date(`${s.startDate}T00:00:00Z`).getUTCDay())]).toEqual([s.key, true]);
      expect(s.capacity).toBeLessThanOrEqual(13);
    }
    // Les dates de début (lundis) sont toutes différentes : une semaine par session, donc aucun chevauchement de salle ni de formateur.
    expect(new Set(sessions.map((s) => s.startDate)).size).toBe(7);
    const keys = new Set(sessions.map((s) => s.key));
    for (const e of plan) {
      if (e.op.k === 'sessionOpen' || e.op.k === 'sessionPostpone' || e.op.k === 'sessionCancel') expect(keys.has(e.op.session)).toBe(true);
    }
    expect(ofKind('sessionOpen')).toHaveLength(5);
    expect(ofKind('sessionPostpone')).toHaveLength(1);
    expect(ofKind('sessionCancel')).toHaveLength(1);
    // Aucune action n'a lieu avant la planification de sa session, et rien n'est daté dans le futur (jamais après la date de référence).
    const plannedAt = new Map(plan.filter((e) => e.op.k === 'session').map((e) => [(e.op as { key: string }).key, e.at.getTime()]));
    for (const e of plan) {
      if (e.op.k === 'sessionOpen' || e.op.k === 'sessionPostpone' || e.op.k === 'sessionCancel') expect(e.at.getTime()).toBeGreaterThan(plannedAt.get(e.op.session)!);
    }
    const reported = ofKind('sessionPostpone')[0]!;
    expect(sessions.find((s) => s.key === reported.session)!.startDate < reported.startDate).toBe(true);
  });

  it('apprenants et inscriptions : chaque inscription désigne un apprenant et une session du plan, et rien n\'est fait sur une inscription avant sa création', () => {
    const learners = ofKind('learner');
    expect(learners).toHaveLength(12);
    expect(new Set(learners.map((l) => l.email)).size).toBe(12);
    for (const l of learners) {
      expect(l.email).toMatch(/@apprenants\.test$/);
      expect(isDemoPhone(l.phone)).toBe(true);
      expect(l.company).toMatch(/^client-formation-[1-5]$/);
    }
    const learnerKeys = new Set(learners.map((l) => l.key));
    // Les entreprises des apprenants sont créées par le même bloc, avec un agrément reçu qui vaut encore plus d'un an après la date de référence.
    const clients = ofKind('company').filter((c) => c.key.startsWith('client-formation-'));
    expect(clients).toHaveLength(5);
    for (const l of learners) expect(clients.some((c) => c.key === l.company)).toBe(true);
    const approvals = ofKind('approval').filter((a) => a.key.startsWith('client-formation-'));
    expect(approvals).toHaveLength(5);
    const lastStart = ofKind('session').map((s) => s.startDate).sort().at(-1)!;
    for (const a of approvals) expect([a.key, a.validUntil! > isoDayPlus(lastStart, 300)]).toEqual([a.key, true]);
    const sessionKeys = new Set(ofKind('session').map((s) => s.key));
    const enrollments = ofKind('enroll');
    expect(enrollments).toHaveLength(14);
    for (const e of enrollments) {
      expect([e.key, learnerKeys.has(e.learner)]).toEqual([e.key, true]);
      expect([e.key, sessionKeys.has(e.session)]).toEqual([e.key, true]);
    }
    const createdAt = new Map(plan.filter((e) => e.op.k === 'enroll').map((e) => [(e.op as { key: string }).key, e.at.getTime()]));
    for (const e of plan) {
      if (e.op.k === 'enrollConfirm' || e.op.k === 'enrollCancel' || e.op.k === 'enrollReplace') expect(e.at.getTime()).toBeGreaterThan(createdAt.get(e.op.enrollment)!);
    }
    // Les apprenants ne sont inscrits qu'à des sessions qui ouvrent avant leur inscription, et jamais à une session qui n'est pas ouverte.
    const opened = new Map(plan.filter((e) => e.op.k === 'sessionOpen').map((e) => [(e.op as { session: string }).session, e.at.getTime()]));
    for (const e of plan) {
      if (e.op.k === 'enroll') expect([e.op.session, e.at.getTime() > (opened.get(e.op.session) ?? Infinity)]).toEqual([e.op.session, true]);
    }
    // La session annulée reçoit ses inscrits avant son annulation ; le replacement a lieu après.
    const cancelledAt = plan.find((e) => e.op.k === 'sessionCancel')!.at.getTime();
    const forCancelled = plan.filter((e) => e.op.k === 'enroll' && e.op.session === 'session-etudiants-annulee');
    expect(forCancelled).toHaveLength(2);
    for (const e of forCancelled) expect(e.at.getTime()).toBeLessThan(cancelledAt);
    expect(plan.find((e) => e.op.k === 'enrollReplace')!.at.getTime()).toBeGreaterThan(cancelledAt);
    // Aucune action de bloc ne dépend d'un autre bloc par clé : les inscriptions désignent leurs entreprises par rang, les sessions par clé du plan.
    expect(blockOf(learners[0]!)).toBe('inscriptions');
  });

  it('ne reprend aucune marque réelle connue du secteur', () => {
    const banned = /(ecobank|afriland|orange|mtn|societe generale|sgbc|bicec|attijariwafa|nsia|sanlam|allianz|axa|oragroup|moov|airtel|vodacom|cimencam|total|shell)/i;
    const text = COMPANIES.map((c) => c.name.normalize('NFD').replace(/[̀-ͯ]/g, '')).join(' ');
    expect(text).not.toMatch(banned);
  });
});
