import { describe, expect, it } from 'vitest';
import { FALLBACK_MENU, findActiveLink, menuPath, sortByOrder, withFrontendLinks } from './menu';

describe('menu', () => {
  it('builds the path of a link', () => {
    expect(menuPath({ title: 'Home', icon: 'home', routerLink: [''], roles: [] })).toBe('/');
    expect(menuPath({ title: 'Fee', icon: 'x', routerLink: ['fee'], roles: [] })).toBe('/fee');
  });

  it('finds the active link (exact or prefix)', () => {
    expect(findActiveLink(FALLBACK_MENU, '/')?.title).toBe('Home');
    expect(findActiveLink(FALLBACK_MENU, '/fee/processed')?.title).toBe('Expenses');
    expect(findActiveLink(FALLBACK_MENU, '/tasks')?.title).toBe('Tasks');
    // tasks is exact: a sub path does not match
    expect(findActiveLink(FALLBACK_MENU, '/tasks/whatever')).toBeUndefined();
    // administration has one url per tab
    expect(findActiveLink(FALLBACK_MENU, '/administration/logs')?.title).toBe('Administration');
  });

  it('sorts links by order', () => {
    const sorted = sortByOrder([
      { title: 'b', order: 2, icon: 'x', routerLink: ['b'], roles: [] },
      { title: 'a', order: 1, icon: 'x', routerLink: ['a'], roles: [] },
    ]);
    expect(sorted.map((l) => l.title)).toEqual(['a', 'b']);
  });

  it('adds the frontend only links to admins, unless the backend menu has them', () => {
    const titles = (authorities: string[], links = FALLBACK_MENU) =>
      withFrontendLinks(links, authorities).map((l) => l.title);
    expect(titles(['ADMIN'])).toContain('Templates');
    expect(titles(['REGULATOR_OR_ACCOUNTANT'])).not.toContain('Templates');
    expect(titles([])).not.toContain('Templates');
    const backend = [
      ...FALLBACK_MENU,
      { title: 'My templates', icon: 'x', routerLink: ['templates'], roles: ['ADMIN'] },
    ];
    expect(titles(['ADMIN'], backend).filter((t) => t.includes('emplates'))).toEqual(['My templates']);
  });
});
