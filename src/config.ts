export interface AppConfig {
  KEYCLOAK_URL: string;
  KEYCLOAK_REALM: string;
  KEYCLOAK_CLIENT_ID: string;
  BACKEND_URL: string;
  FRONTEND_URL?: string;
  SPARQL_ENDPOINT?: string;
  SPARQL_DEFAULT_QUERY?: string;
  ENV_TYPE?: string;
}

declare const __APP_VERSION__: string;
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

let config: AppConfig | null = null;

/** runtime config, generated at container start from env variables (see replace_placeholder.sh) */
export async function loadConfig(): Promise<AppConfig> {
  const file = import.meta.env.DEV ? '/assets/config/config.dev.json' : '/assets/config/config.json';
  const response = await fetch(file, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`could not load config ${file}: ${response.status}`);
  }
  config = (await response.json()) as AppConfig;
  return config;
}

export function setConfig(c: AppConfig) {
  config = c;
}

export function getConfig(): AppConfig {
  if (!config) {
    throw new Error('config not loaded');
  }
  return config;
}
