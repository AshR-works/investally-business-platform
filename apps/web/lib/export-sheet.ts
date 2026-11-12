import { api } from './api';

/**
 * Ouvre la fiche d'une entreprise dans une nouvelle fenêtre et lance l'impression (le navigateur propose
 * « Enregistrer au format PDF »). Le document vient du serveur, qui vérifie la portée de l'utilisateur et TRACE l'export dans
 * l'audit : la fenêtre est ouverte tout de suite (clic de l'utilisateur, sinon le navigateur la bloque), puis remplie.
 */
export async function openCompanySheet(companyId: string): Promise<void> {
  return openSheet(`/companies/${companyId}/export`);
}

/** Même chose pour l'offre : document de la charte graphique, contrôlé et tracé par le serveur. */
export async function openOfferSheet(offerId: string): Promise<void> {
  return openSheet(`/offers/${offerId}/export`);
}

async function openSheet(path: string): Promise<void> {
  const win = window.open('', '_blank');
  if (!win) throw new Error('Le navigateur a bloqué la nouvelle fenêtre : autorisez les fenêtres pour ce site, puis recommencez.');
  try {
    const html = await (await api<Blob>(path, { blob: true })).text();
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    // Laisse au navigateur le temps de mettre en page avant d'ouvrir la boîte d'impression.
    setTimeout(() => win.print(), 400);
  } catch (error) {
    win.close();
    throw error;
  }
}
