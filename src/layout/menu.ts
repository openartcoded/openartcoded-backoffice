import type { MenuLink } from '@/types';

const ALL = ['REGULATOR_OR_ACCOUNTANT', 'ADMIN'];
const ADMIN = ['ADMIN'];

const link = (title: string, icon: string, path: string, order: number, roles: string[], exact = false): MenuLink => ({
  title,
  icon: ['fas', icon],
  routerLink: [path],
  order,
  show: true,
  roles,
  routerLinkActiveOptions: { exact },
});

/** used until the menu links are loaded from the backend (or if it fails) */
export const FALLBACK_MENU: MenuLink[] = [
  link('Home', 'home', '', 0, ALL, true),
  link('Tasks', 'tasks', 'tasks', 1, ADMIN, true),
  { ...link('Timesheet', 'clock', 'timesheets', 2, ADMIN, true), show: false },
  link('Expenses', 'money-bill-wave', 'fee', 3, ALL),
  link('Invoices', 'file-invoice-dollar', 'invoice', 4, ALL),
  link('Dossiers', 'folder-open', 'dossier', 5, ALL),
  link('Documents', 'unlock-alt', 'documents', 6, ALL, true),
  link('Report', 'blog', 'report', 8, ADMIN),
  link('Gallery', 'images', 'memzagram', 9, ADMIN),
  link('CV', 'university', 'cv', 10, ADMIN),
  link('Finance', 'chart-line', 'finance', 11, ADMIN),
  link('Uploads', 'upload', 'file-upload', 12, ALL),
  link('Sparql', 'database', 'endpoint-sparql', 14, ADMIN, true),
  link('Prospects', 'concierge-bell', 'services', 20, ADMIN, true),
  link('Clients', 'user', 'billable-clients', 21, ALL, true),
  link('Mails', 'mail-bulk', 'mails', 22, ADMIN, true),
  link('Administration', 'cog', 'administration', 23, ALL),
];

/** '/fee', '/' ... */
export function menuPath(link: MenuLink): string {
  return '/' + link.routerLink.filter((s) => s !== '').join('/');
}

/** the menu link matching the current path */
export function findActiveLink(links: MenuLink[], pathname: string): MenuLink | undefined {
  return links.find((l) => {
    const path = menuPath(l);
    if (path === '/') return pathname === '/';
    return l.routerLinkActiveOptions?.exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
  });
}

export const sortByOrder = (links: MenuLink[]) => [...links].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/**
 * pages of this frontend not (yet) in the menu configured in the backend, which the old frontend also reads.
 * Shown until the backend menu has a link with the same path.
 */
export const FRONTEND_ONLY_LINKS: MenuLink[] = [link('Templates', 'file-code', 'templates', 13, ADMIN, true)];

/** the visible links, plus the frontend only links the user may see and the backend doesn't have */
export function withFrontendLinks(links: MenuLink[], authorities: string[] = []): MenuLink[] {
  const paths = new Set(links.map(menuPath));
  const extra = FRONTEND_ONLY_LINKS.filter(
    (l) => !paths.has(menuPath(l)) && l.roles.some((r) => authorities.includes(r)),
  );
  return extra.length ? sortByOrder([...links, ...extra]) : links;
}
