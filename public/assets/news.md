#### 2027.8.1

- Templates: sort on every column (name, type, version, updated, the default templates on top by default), search in the name, description and type, filter on the version or show only the default templates. Kept in the url
- Templates: new "CV RDF" template type (Jinja), the sparql update publishing the CV to the triplestore. Fixed: special characters, empty fields and personal projects
- The application starts even when the pdf of the CV cannot be generated
- Pdf generation recovers by itself when its browser crashes, no restart needed anymore

#### 2027.8.0

- Home, per year: new "Relative" column, the revenue of the year per calendar day worked (from the timesheets, a day counts once however many hours are invoiced that day). Only for the years with a timesheet every month, and the current year
- Home charts: new "Hours" tab (timesheets): hours per year and client, progress month by month compared with the previous years, hours per client with the progress against the same months last year. Student jobs are left out
- Expenses: new "Exceptional" tab, the expenses far above the usual ones (x times the median, minimum amount, both adjustable). Select several and mark them as exceptional (taxes, one-off purchases) or normal, or reset
- Home: "Business plan" button, a business plan / plan financier / financieel plan (pdf) in English, French or Dutch, from the invoices and the expenses: key figures, progress over the years and during the year, expenses, exceptional expenses apart, projected results for the next 3 years (prudent / realistic / optimistic), optional loan with its monthly payment and coverage
- Templates: new "Business plan" template type, the layout of the business plan can be changed there

#### 2027.7.0

- Mails: pick the attachments among the uploads (search, bookmarked, several at once) or upload new files, in the send mail popup and in the scheduled mails not sent yet
- Invoices: extra files attached to an invoice, embedded in the Peppol XML (pdf, png, jpeg, csv, xlsx, ods), sent with the invoice mail and deleted with the invoice. Also on generated (locked) invoices: the Peppol XML not sent yet is generated again

#### 2027.6.0

- Home redesigned: key figures, activity chart and post-its, yearly figures (revenue, days, per day) and the company card on one page, scrolling only where needed
- Administration: system status, to do and next tasks on the side, the rest in tabs using the whole width
- Reports: new kanban board, fixed scrolling

#### 2027.5.0

- New "Administration" menu: to do, post-its, toolbox, script console, system info and logs (moved from the home page)

#### 2027.4.0

- Dossiers: the closed dossiers grouped by year, with the annual report of each year (pdf: every dossier of the year compared with the other years, and a projection). Mailed every 20th of january for the previous year

#### 2027.3.0

- Uploads: new search in the content of the files (pdf, spreadsheets, csv, documents, images, text) with several modes (smart, exact words, word beginnings, typos, exact phrase, regular expression, query syntax), filters on the type, the extensions and the dates, and a preview of the matching parts

#### 2027.2.1

- Dossier report: every month of the dossier in one pdf

#### 2027.2.0

- Dossiers: monthly pdf report of a dossier, compared with the previous years. Mailed every month (open dossier, previous month) and every quarter

#### 2027.1.0

- New "Templates" page: every type (invoice, CV, timesheet, Peppol, emails, SMS, calendar invites, dossier report) has one default template, v1 (FreeMarker) or v2 (Jinja), with the variables it reads

#### 2027.0.2

- Fix the scripts widget (enabled / disabled status)

#### 2027.0.1

- Invoices: choose the default template of new invoices
- Personal info: second phone number, shown on the company card
- Settings: the modal keeps its size when switching tabs
- Nothing scrolls horizontally anymore, long words (urls, file names) wrap

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
