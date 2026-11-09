import { useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/api/misc';
import { FALLBACK_MENU, sortByOrder } from './menu';

export const MENU_KEY = ['menu-links'];

/** menu links configured in the backend (all of them, visible or not) */
export function useMenuLinks() {
  const query = useQuery({ queryKey: MENU_KEY, queryFn: settingsApi.menuLinks });
  const all = query.data ? sortByOrder(query.data) : FALLBACK_MENU;
  return { ...query, all, visible: all.filter((l) => l.show) };
}

export function useInvalidateMenu() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: MENU_KEY });
}
