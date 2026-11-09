#### 2027.0.0

- Switch from Angular to React (React 19, TypeScript, Vite, Mantine)
- Design refresh: light sidebar (collapsible), slim header, consistent page headers with visible actions
- Command palette with `Ctrl+K` to jump to any page
- Details (invoice, expense, client, dossier...) open in a side drawer, the list stays visible
- Cleaner tables: status badges, aligned amounts, empty states, grouped row actions, filters above the lists
- The page never scrolls, only the lists and panels do (filters and pagination stay visible)
- Home: key figures, to do / next tasks / activity / toolbox... as tabs, post-its on the right, quick links as icons (`Ctrl+&`, `Ctrl+é`, `Ctrl+"`...)
- Tasks: new action results and notifications tabs
- Settings (personal info, menu, cache) in a modal from the user menu, menu reordered by drag & drop
- PDFs rendered with pdf.js, errors (download, preview...) are now shown
- `Alt+N` creates a new item on the current page (was `Ctrl+K`)

#### 2026.5.9

- retry send mail
- timesheet page: automatically set a day as holiday

#### 2026.5.8

- fix peppol consuming file before it's download
- fix mobile main page (stick left menu)
- skip peppol generation for customers not using peppol
- add a comment to a dossier

#### 2026.5.7

- automatically subscribe when a new report is created
- missing space between <generic-summary/> and tasks on mobile
- if mail job fails, mark it as failed
- fix tags taking too much space in report page
- add simple emojis

#### 2026.5.6

- Fix channel notification

#### 2026.5.5

- BUG expense: Set tag prevent default
- Style BUG: tasks in report was not taking the full width
- Allow calling feeRepository from Graal.js
- remove dead code in post editor
- Add a message counter for each visible posts in post table
- ask politely to change the cover

#### 2026.5.4

- Add PDF Generation for reports (view detail, next to the updated date)
- Fix tasks in report not saving and showing properly
- Filter on status and priority for reports
- Added and set `ASYNC_REQUEST_TIMEOUT` to 60s (Broken pipe error)
- Increase tmpfs to 4GB
- process attachments in report
- Added due date for report
- Added channels
- Tasks in detail view
- Quality of life improvements
- Password generator in home > toolbox
- News module
- New markdown editor on reports (easyMde)
- New default font
