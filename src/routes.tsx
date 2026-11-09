import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Center, Loader } from '@mantine/core';
import { AppLayout } from './layout/AppLayout';
import { RequireRole } from './auth/RequireRole';
import { ROLE_ACCOUNTANT, ROLE_ADMIN } from './types';
import { NotFoundPage } from './features/home/NotFoundPage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function page<T extends Record<string, ComponentType<any>>>(loader: () => Promise<T>, name: keyof T) {
  return lazy(() => loader().then((m) => ({ default: m[name] })));
}

const HomePage = page(() => import('./features/home/HomePage'), 'HomePage');
const TasksPage = page(() => import('./features/tasks/TasksPage'), 'TasksPage');
const TimesheetsPage = page(() => import('./features/timesheet/TimesheetsPage'), 'TimesheetsPage');
const TimesheetDetailPage = page(() => import('./features/timesheet/TimesheetDetailPage'), 'TimesheetDetailPage');
const ClientsPage = page(() => import('./features/clients/ClientsPage'), 'ClientsPage');
const InvoicePage = page(() => import('./features/invoice/InvoicePage'), 'InvoicePage');
const FeePage = page(() => import('./features/fee/FeePage'), 'FeePage');
const DossierPage = page(() => import('./features/dossier/DossierPage'), 'DossierPage');
const DocumentsPage = page(() => import('./features/documents/DocumentsPage'), 'DocumentsPage');
const UploadsPage = page(() => import('./features/uploads/UploadsPage'), 'UploadsPage');
const FinancePage = page(() => import('./features/finance/FinancePage'), 'FinancePage');
const MailsPage = page(() => import('./features/mail/MailsPage'), 'MailsPage');
const GalleryPage = page(() => import('./features/gallery/GalleryPage'), 'GalleryPage');
const ProspectsPage = page(() => import('./features/prospects/ProspectsPage'), 'ProspectsPage');
const SparqlPage = page(() => import('./features/sparql/SparqlPage'), 'SparqlPage');
const ReportsPage = page(() => import('./features/report/ReportsPage'), 'ReportsPage');
const PostEditorPage = page(() => import('./features/report/PostEditorPage'), 'PostEditorPage');
const PostDetailPage = page(() => import('./features/report/PostDetailPage'), 'PostDetailPage');
const CvPage = page(() => import('./features/cv/CvPage'), 'CvPage');
const CvRequestsPage = page(() => import('./features/cv/CvRequestsPage'), 'CvRequestsPage');
const CvEditorPage = page(() => import('./features/cv/CvEditorPage'), 'CvEditorPage');

const ADMIN = [ROLE_ADMIN];
const ALL = [ROLE_ADMIN, ROLE_ACCOUNTANT];

function Guard({ roles, children }: { roles: string[]; children: ReactNode }) {
  return <RequireRole roles={roles}>{children}</RequireRole>;
}

export function AppRoutes() {
  const r = (path: string, roles: string[], element: ReactNode) => (
    <Route key={path} path={path} element={<Guard roles={roles}>{element}</Guard>} />
  );
  return (
    <Suspense
      fallback={
        <Center h="100vh">
          <Loader />
        </Center>
      }
    >
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="404" element={<NotFoundPage />} />
          {r('cv', ADMIN, <CvPage />)}
          {r('cv/download-requests', ADMIN, <CvRequestsPage />)}
          {r('cv/editor', ADMIN, <CvEditorPage />)}
          {r('tasks', ADMIN, <TasksPage />)}
          {r('documents/:name?', ALL, <DocumentsPage />)}
          {r('billable-clients', ALL, <ClientsPage />)}
          {r('timesheets', ADMIN, <TimesheetsPage />)}
          {r('timesheets/timesheet/:id', ADMIN, <TimesheetDetailPage />)}
          {r('mails', ADMIN, <MailsPage />)}
          {r('services', ADMIN, <ProspectsPage />)}
          {r('report/post/new', ADMIN, <PostEditorPage />)}
          {r('report/post/:title/:id/edit', ADMIN, <PostEditorPage />)}
          {r('report/post/:title/:id', ADMIN, <PostDetailPage />)}
          {r('report/:name?', ADMIN, <ReportsPage />)}
          {r('memzagram', ADMIN, <GalleryPage />)}
          {r('invoice/:name?', ALL, <InvoicePage />)}
          {r('file-upload/:name?', ALL, <UploadsPage />)}
          {r('fee/:name?', ALL, <FeePage />)}
          {r('dossier/:name?', ALL, <DossierPage />)}
          {r('finance/:name?', ADMIN, <FinancePage />)}
          {r('endpoint-sparql', ADMIN, <SparqlPage />)}
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
