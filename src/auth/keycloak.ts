import Keycloak from 'keycloak-js';
import type { AppConfig } from '@/config';

let keycloak: Keycloak | null = null;

/** initializes keycloak and forces the login (every page of the backoffice requires authentication) */
export async function initKeycloak(config: AppConfig): Promise<Keycloak> {
  keycloak = new Keycloak({
    url: config.KEYCLOAK_URL,
    realm: config.KEYCLOAK_REALM,
    clientId: config.KEYCLOAK_CLIENT_ID,
  });
  keycloak.onTokenExpired = () => {
    keycloak?.updateToken(180).catch(() => keycloak?.login());
  };
  await keycloak.init({
    onLoad: 'login-required',
    checkLoginIframe: false,
    pkceMethod: 'S256',
  });
  return keycloak;
}

/** returns a valid access token, refreshing it when it expires in less than 30s */
export async function getToken(): Promise<string | undefined> {
  if (!keycloak?.authenticated) return undefined;
  try {
    await keycloak.updateToken(30);
  } catch {
    await keycloak.login();
  }
  return keycloak.token;
}

export function logout() {
  keycloak?.logout({ redirectUri: window.location.origin });
}

/** realm + client roles of the logged in user */
export function getRoles(): string[] {
  if (!keycloak?.tokenParsed) return [];
  const realm = keycloak.tokenParsed.realm_access?.roles ?? [];
  const resources = Object.values(keycloak.tokenParsed.resource_access ?? {}).flatMap((r) => r.roles ?? []);
  return [...new Set([...realm, ...resources])];
}
