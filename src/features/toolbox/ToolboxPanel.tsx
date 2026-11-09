import { Paper, Tabs } from '@mantine/core';
import { DateTools } from './DateTools';
import { Base64Tools, PasswordGenerator, PathFinderTools, QrCodeTool, RdfaTool, RdfTools } from './TextTools';

const TOOLS = [
  { value: 'date', label: 'Date', element: <DateTools /> },
  { value: 'base64', label: 'Base64', element: <Base64Tools /> },
  { value: 'rdf', label: 'RDF', element: <RdfTools /> },
  { value: 'pathfinder', label: 'Pathfinder', element: <PathFinderTools /> },
  { value: 'htmlToRdfa', label: 'RDFa', element: <RdfaTool /> },
  { value: 'qrcode', label: 'QRCode', element: <QrCodeTool /> },
  { value: 'pwdgen', label: 'Password Generator', element: <PasswordGenerator /> },
];

export function ToolboxPanel() {
  return (
    <Tabs defaultValue="date" orientation="vertical" placement="right" variant="pills" keepMounted={false}>
      <Tabs.List miw={170}>
        {TOOLS.map((t) => (
          <Tabs.Tab key={t.value} value={t.value}>
            {t.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {TOOLS.map((t) => (
        <Tabs.Panel key={t.value} value={t.value} pr="md">
          <Paper p="md" bg="gray.0">
            {t.element}
          </Paper>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
