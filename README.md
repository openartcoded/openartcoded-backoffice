# openartcoded backoffice

Backoffice of [openartcoded](https://github.com/openartcoded): invoices, expenses, dossiers, timesheets, reports, CV, tasks, etc.

## Stack

- React 19 + TypeScript, built with Vite
- [Mantine](https://mantine.dev) 8 for the UI (core, form, modals, notifications, dropzone, charts on recharts)
- react-router, TanStack Query, axios
- keycloak-js for authentication
- Vitest + Testing Library for the unit tests (API modules are mocked, no e2e)

## Development

```sh
npm i
npm run dev        # http://localhost:4200, uses public/assets/config/config.dev.json
npm test           # unit tests
npm run typecheck
npm run lint
npm run build      # output in dist/
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
