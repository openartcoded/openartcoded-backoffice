import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/spotlight/styles.css';
import './styles.css';
import { loadConfig } from './config';
import { configureHttp, errorMessage } from './api/http';
import { toast } from './lib/ui';
import { getToken, initKeycloak, logout } from './auth/keycloak';
import { App } from './App';

// actions (download, save, ...) are often fire and forget: a failure must never be silent
window.addEventListener('unhandledrejection', (event) => {
  toast.error(errorMessage(event.reason));
});

async function bootstrap() {
  const root = createRoot(document.getElementById('root')!);
  try {
    const config = await loadConfig();
    await initKeycloak(config);
    configureHttp({ baseURL: config.BACKEND_URL, getToken, onUnauthorized: logout });
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (e) {
    console.error(e);
    root.render(<p style={{ padding: 16 }}>Could not start the application: {String(e)}</p>);
  }
}

bootstrap();
