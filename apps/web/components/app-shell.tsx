'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { activeModule, availableModules, byDomain, type Domain } from '../lib/modules';
import { isDomainOpen, toggleDomain, type OpenDomain } from '../lib/nav-state';
import { useDismiss } from '../lib/use-dismiss';
import { roleLabel } from '../lib/permissions';
import { applyTheme, effectiveTheme, readTheme } from '../lib/theme';
import { Icon, type IconName } from './icon';

/** Événement envoyé au hub pour mettre le focus dans la recherche globale (raccourci Ctrl/⌘ K, bouton de la barre). */
export const FOCUS_SEARCH_EVENT = 'investally:focus-search';

/** Navigation fixe à gauche (le panneau garde sa place) ou, une fois dépliée depuis le rail, PAR-DESSUS le contenu sans le déplacer. */
const NAV_STICKY = 'min-[901px]:sticky min-[901px]:top-3 min-[901px]:col-start-1 min-[901px]:h-[calc(100vh-24px)] min-[901px]:w-[var(--nav-w)] min-[901px]:justify-self-start';
const NAV_OVERLAY = 'min-[901px]:fixed min-[901px]:left-3 min-[901px]:top-3 min-[901px]:z-40 min-[901px]:h-[calc(100vh-24px)] min-[901px]:w-72 min-[901px]:rounded-card min-[901px]:bg-surface min-[901px]:shadow-[var(--shadow-3)]';

/**
 * Coque de toutes les pages connectées (EXD-01, EXD-05, EXD-10, EXD-11) :
 * - navigation complète sur la Vue d'ensemble ; ailleurs, un rail compact (84 px) dont le bouton-pictogramme DÉPLOIE la navigation PAR-DESSUS le contenu (sans le déplacer) ;
 *   elle se replie au clic en dehors, à Échap et à chaque changement de page, et une seule rubrique reste ouverte à la fois (lot A) ;
 * - panneau principal centré sur la fenêtre (marge gauche ≥ navigation, repli automatique quand la fenêtre est étroite) ;
 * - sur mobile, la navigation devient un tiroir ouvert par le bouton de menu.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { profile, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const hub = pathname === '/';
  const [expanded, setExpanded] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const aside = useRef<HTMLElement>(null);
  // Aspect de la navigation : complète sur la Vue d'ensemble ou une fois dépliée, sinon rail. La MISE EN PAGE, elle, ne dépend que de la Vue d'ensemble :
  // dépliée ailleurs, la navigation passe par-dessus le contenu (aucun décalage sous le curseur).
  const look: 'full' | 'rail' = hub || expanded ? 'full' : 'rail';
  const overlay = expanded && !hub;
  const [manual, setManual] = useState<OpenDomain>(null);

  // Changement de page : le tiroir mobile et la navigation dépliée se referment ; l'accordéon repart de la rubrique de la page.
  useEffect(() => {
    setDrawer(false);
    setExpanded(false);
    setManual(null);
  }, [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setDrawer(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);
  // Navigation dépliée par-dessus le contenu : se replie au clic en dehors et à Échap.
  useDismiss(aside, overlay, () => setExpanded(false));

  const toggleExpanded = () => setExpanded((current) => !current);

  /** Va à la recherche globale du hub (ou y met le focus si l'on y est déjà). */
  const openSearch = useCallback(() => {
    if (pathname === '/') window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
    else router.push('/#recherche');
  }, [pathname, router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSearch]);

  const modules = availableModules(profile);
  const active = activeModule(modules, pathname);
  // Domaines du menu (D51) : une seule rubrique ouverte à la fois, par défaut celle de la page courante ; rien n'est mémorisé d'une page à l'autre (lot A).
  const isOpen = (domain: Domain) => isDomainOpen(manual, active?.group, domain);
  const onToggleDomain = (domain: Domain) => setManual((current) => toggleDomain(current, active?.group, domain));
  const initials = (profile?.displayName ?? '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const railOnly = 'group-data-[look=rail]/nav:min-[901px]:sr-only';
  const centered = 'group-data-[look=rail]/nav:min-[901px]:justify-center';

  return (
    <div
      data-nav={hub ? 'full' : 'rail'}
      className="group/shell grid min-h-screen bg-canvas p-3 text-ink [--nav-w:272px] [--panel-max:1440px] data-[nav=rail]:[--nav-w:84px] max-[900px]:grid-cols-[minmax(0,1fr)] max-[900px]:p-0 min-[901px]:grid-cols-[minmax(var(--nav-w),1fr)_minmax(0,var(--panel-max))_minmax(0,1fr)]"
    >
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow-[var(--shadow-2)]">
        Aller au contenu
      </a>

      {drawer && <div className="fixed inset-0 z-30 bg-black/50 min-[901px]:hidden" aria-hidden="true" onClick={() => setDrawer(false)} />}

      <aside
        ref={aside}
        id="navigation"
        aria-label="Barre latérale"
        data-look={look}
        className={`group/nav flex flex-col gap-1 overflow-y-auto px-4 py-4 ${overlay ? NAV_OVERLAY : NAV_STICKY} max-[900px]:fixed max-[900px]:inset-y-0 max-[900px]:left-0 max-[900px]:z-40 max-[900px]:w-72 max-[900px]:bg-surface max-[900px]:shadow-[var(--shadow-3)] max-[900px]:transition-transform data-[look=rail]:min-[901px]:items-center data-[look=rail]:min-[901px]:px-2 ${drawer ? '' : 'max-[900px]:invisible max-[900px]:-translate-x-full'}`}
      >
        <Link href="/" aria-label="Investally — Vue d’ensemble" className="mb-4 block rounded-control px-3 py-1">
          <img src="/brand/logo-investally-rectangle.png" alt="" width={1000} height={299} className="logo-img h-auto w-[150px] group-data-[look=rail]/nav:min-[901px]:hidden" />
          <img src="/brand/logo-investally-symbole.png" alt="" width={240} height={225} className="logo-img hidden h-auto w-10 group-data-[look=rail]/nav:min-[901px]:block" />
        </Link>

        <nav aria-label="Navigation principale" className="flex w-full flex-1 flex-col gap-0.5">
          <ShellLink href="/" icon="grid" label="Vue d’ensemble" current={pathname === '/'} railOnly={railOnly} centered={centered} rail={look === 'rail'} />
          {byDomain(modules).map(({ domain, items }) => {
            const open = isOpen(domain);
            const listId = `nav-${domain.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').toLowerCase()}`;
            return (
              <div key={domain} className="flex flex-col gap-0.5">
                {/* Rail replié (bureau) : pas de bouton, le domaine n'est qu'un séparateur lu par les lecteurs d'écran et toutes les entrées restent visibles. */}
                <p className={`hidden px-3 pb-2 pt-5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-2 ${railOnly} group-data-[look=rail]/nav:min-[901px]:block`}>{domain}</p>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => onToggleDomain(domain)}
                  className="flex w-full cursor-pointer items-center justify-between rounded-control border-0 bg-transparent px-3 pb-2 pt-5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-ink-2 hover:text-ink group-data-[look=rail]/nav:min-[901px]:hidden"
                >
                  <span>{domain}</span>
                  <Icon name="chevron-down" className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                <div id={listId} className={open ? 'flex flex-col gap-0.5' : 'hidden flex-col gap-0.5 group-data-[look=rail]/nav:min-[901px]:flex'}>
                  {items.map((m) => (
                    <ShellLink key={m.id} href={m.href!} icon={m.icon} label={m.label} current={active?.id === m.id} railOnly={railOnly} centered={centered} rail={look === 'rail'} />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {!hub && (
          <button
            type="button"
            aria-label="Navigation complète"
            aria-expanded={look === 'full'}
            aria-controls="navigation"
            title={look === 'full' ? 'Replier la navigation' : 'Déplier la navigation'}
            onClick={toggleExpanded}
            className="mt-2 hidden size-11 shrink-0 cursor-pointer place-items-center rounded-control border border-line-strong bg-transparent p-0 text-ink-2 hover:bg-surface hover:text-ink min-[901px]:grid"
          >
            <Icon name={look === 'full' ? 'panel-close' : 'panel-open'} />
          </button>
        )}

        <div className="mt-3 flex flex-col gap-0.5 border-t border-line pt-3 group-data-[look=rail]/nav:min-[901px]:items-center">
          <ShellLink href="/account" icon="user" label="Mon compte" current={pathname.startsWith('/account')} railOnly={railOnly} centered={centered} rail={look === 'rail'} />
          <button
            type="button"
            onClick={() => void logout()}
            title={look === 'rail' ? 'Se déconnecter' : undefined}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-control border-0 bg-transparent px-3 py-2.5 text-left font-medium text-ink-2 hover:bg-surface hover:text-ink ${centered}`}
          >
            <Icon name="logout" />
            <span className={railOnly}>Se déconnecter</span>
          </button>
        </div>
      </aside>

      <div className="min-w-0 overflow-clip rounded-card border border-line bg-bg shadow-[var(--shadow-panel)] max-[900px]:rounded-none max-[900px]:border-0 min-[901px]:col-start-2">
        <header className="flex items-center gap-3 border-b border-line px-6 py-3 max-[900px]:px-4">
          <button
            type="button"
            aria-label="Ouvrir le menu"
            aria-expanded={drawer}
            aria-controls="navigation"
            onClick={() => setDrawer(true)}
            className="grid size-11 cursor-pointer place-items-center rounded-control border border-line-strong bg-transparent p-0 text-ink-2 hover:bg-surface min-[901px]:hidden"
          >
            <Icon name="menu" />
          </button>
          <button
            type="button"
            onClick={openSearch}
            aria-keyshortcuts="Control+K Meta+K"
            className="flex h-11 min-w-0 max-w-md flex-1 cursor-pointer items-center gap-2 rounded-full border border-field bg-surface px-4 text-left font-normal text-ink-2 hover:bg-surface-2"
          >
            <Icon name="search" className="size-4" />
            <span className="truncate">Rechercher partout</span>
            <kbd className="ml-auto hidden rounded-chip border border-line-strong px-1.5 text-xs text-ink-2 sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            {/* La pastille et le nom mènent à « Mon compte » (profil, mot de passe, codes de secours, sessions). */}
            <Link
              href="/account"
              aria-label={`Mon compte : ${profile?.displayName ?? ''}`}
              aria-current={pathname.startsWith('/account') ? 'page' : undefined}
              className="flex items-center gap-3 rounded-control border-l border-line py-1 pl-4 pr-2 text-ink no-underline hover:bg-surface-2"
            >
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink">{initials}</span>
              <div className="leading-tight max-[900px]:hidden">
                <strong className="block text-sm">{profile?.displayName}</strong>
                <span className="text-xs text-ink-2">{profile?.roles.map(roleLabel).join(', ')}</span>
              </div>
            </Link>
          </div>
        </header>
        <main id="contenu" tabIndex={-1} className="p-8 text-[length:var(--text-base)] outline-none max-[900px]:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Lien de navigation : pictogramme + libellé (le libellé reste lu par les lecteurs d'écran quand le rail est replié). */
function ShellLink({ href, icon, label, current, railOnly, centered, rail }: { href: string; icon: IconName; label: string; current: boolean; railOnly: string; centered: string; rail: boolean }) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      title={rail ? label : undefined}
      className={`flex items-center gap-3 rounded-control px-3 py-2.5 font-medium no-underline hover:bg-surface hover:text-ink ${centered} ${current ? 'bg-surface text-ink shadow-[var(--shadow-1)]' : 'text-ink-2'}`}
    >
      <Icon name={icon} />
      <span className={railOnly}>{label}</span>
    </Link>
  );
}

/** Bascule clair / sombre (le choix est mémorisé ; sans choix, l'application suit le réglage de l'appareil). */
function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(effectiveTheme(readTheme()) === 'dark'), []);
  const toggle = () => {
    applyTheme(dark ? 'light' : 'dark');
    setDark(!dark);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Passer au thème clair' : 'Passer au thème sombre'}
      className="grid size-11 cursor-pointer place-items-center rounded-control border border-transparent bg-transparent p-0 text-ink-2 hover:bg-surface hover:text-ink"
    >
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  );
}
