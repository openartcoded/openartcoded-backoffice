import { useQuery } from '@tanstack/react-query';
import { personalInfoApi } from '@/api/misc';
import { ROLE_ADMIN } from '@/types';

export const ME_KEY = ['me'];
export const PERSONAL_INFO_KEY = ['personal-info'];

/** the user as known by the backend (authorities, email...) */
export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: personalInfoApi.me, staleTime: Infinity });
}

export function usePersonalInfo() {
  return useQuery({ queryKey: PERSONAL_INFO_KEY, queryFn: personalInfoApi.get, staleTime: Infinity });
}

export function useIsAdmin(): boolean {
  const { data } = useMe();
  return !!data?.authorities?.includes(ROLE_ADMIN);
}

/** in demo mode, sensitive data is blurred */
export function useDemoMode(): boolean {
  const { data } = usePersonalInfo();
  return !!data?.demoMode;
}
