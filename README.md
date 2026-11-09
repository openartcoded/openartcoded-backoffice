# openartcoded backoffice

Backoffice of [openartcoded](https://github.com/openartcoded): invoices, expenses, dossiers, timesheets, reports, CV, tasks, etc.

## Stack

- React 19 + TypeScript, built with Vite
- [Mantine](https://mantine.dev) 8 for the UI (core, form, modals, notifications, dropzone, charts on recharts)
- react-router, TanStack Query, axios
- keycloak-js for authentication
- Vitest + Testing Library for the unit tests (API modules are mocked, no e2e)

## UI conventions

Plain Mantine, no custom design system. A few shared pieces keep the pages consistent (`src/components/ui.tsx`):

- `PageHeader`: title, short description and the main actions as visible buttons
- details (invoice, expense, client, dossier...) open in a right side drawer (`openDrawer`), small forms and confirmations in modals
- tables: `StatusBadge` for backend enums, `MoneyCell` for amounts, `EmptyRow`/`EmptyState`, `RowActions` (frequent actions inline, the others in a grouped menu)
- filters sit above the tables, rare filters in "More filters"
- the browser window never scrolls: a page is its header + one body block that scrolls inside
  (tabs: the tab list stays, the panel scrolls). Lists use `.fill-column`: filters and pagination stay,
  only the `.scroll-body` (the table) scrolls

Shortcuts: `Ctrl+K` command palette, `Alt+N` new item on the current page, `Ctrl+&`, `Ctrl+é`, `Ctrl+"`, `Ctrl+'`, `Ctrl+(` most clicked links (home, azerty number row), `Ctrl+²` home.

## Development

```sh
npm i
npm run dev        # http://localhost:4200, uses public/assets/config/config.dev.json
npm test           # unit tests
npm run typecheck
npm run lint
npm run build      # output in dist/
```

### Dev proxy

Like `proxy.conf.json` in the Angular app, `npm run dev` proxies `/api`, `/sparql` and `/proxy` to the backend
(`server.proxy` in `vite.config.ts`), so `config.dev.json` keeps `BACKEND_URL=http://localhost:4200`.
The target defaults to `https://backoffice.somehost.org`; to use another one, copy `.env.example` to `.env.local`:

```sh
PROXY_TARGET=http://localhost:9000
```

## Configuration

The config is loaded at runtime from `/assets/config/config.json`. In the Docker image it's generated at startup from
`config.prod.json` and the following environment variables:

| Variable             | Description                          |
| -------------------- | ------------------------------------ |
| `KEYCLOAK_URL`       | Keycloak base url                    |
| `KEYCLOAK_REALM`     | Keycloak realm                       |
| `KEYCLOAK_CLIENT_ID` | Keycloak client id                   |
| `BACKEND_URL`        | API backend url                      |
| `FRONTEND_URL`       | public website url                   |
| `SPARQL_ENDPOINT`    | SPARQL endpoint used by the sparql page |
| `ENV_TYPE`           | environment name                     |
| `IMMO_ENABLED`       | enables the immo module              |

## Docker

```sh
docker build -t nbittich/openartcoded-backoffice .
docker run -p 80:80 -e BACKEND_URL=... -e KEYCLOAK_URL=... nbittich/openartcoded-backoffice
```

The GitHub workflows run the tests, build the app and push `nbittich/openartcoded-backoffice`:

- `build-pr.yml`: pull requests / develop branches → `:dev`
- `docker-image.yml`: main → `:latest`
- `docker-publish.yml`: tags → `:<version>`

## Project layout

```
src/
  api/         backend calls (one module per domain)
  auth/        keycloak & session hooks
  components/  shared components (forms, files, markdown, modal...)
  features/    one folder per page (invoice, fee, dossier, timesheet, report, cv...)
  layout/      app shell, menu, settings
  lib/         formatting, validators, notification bus
  types/       backend models
```
