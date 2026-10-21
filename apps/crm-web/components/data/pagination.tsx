/** Bornes affichées « de – à » pour une page (1-indexée) ; `0–0` quand il n'y a aucun résultat. */
export function pageRange(page: number, pageSize: number, total: number): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  return { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, total) };
}

/** Pied de tableau : « 1–20 sur 48 » et boutons Précédent / Suivant. */
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const { from, to } = pageRange(page, pageSize, total);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[length:var(--text-sm)] text-ink-2">
      <span>{from}–{to} sur {total}</span>
      <div className="flex gap-2">
        <button type="button" className="secondary small" disabled={page <= 1} onClick={() => onPage(page - 1)}>Précédent</button>
        <button type="button" className="secondary small" disabled={page >= pages} onClick={() => onPage(page + 1)}>Suivant</button>
      </div>
    </nav>
  );
}
