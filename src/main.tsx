import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/charts/styles.css';
import './styles.css';
import { loadConfig } from './config';
import { configureHttp } from './api/http';
import { getToken, initKeycloak, logout } from './auth/keycloak';
import { App } from './App';

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
