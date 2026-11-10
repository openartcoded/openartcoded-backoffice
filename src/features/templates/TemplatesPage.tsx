import { useSearchParams } from 'react-router';
import { Badge, Button, Code, Group, List, Loader, Select, Table, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { NoContent } from '@/components/common';
import { openModal } from '@/components/modal';
import { EmptyRow, PageHeader, RowActions, StatusBadge } from '@/components/ui';
import { errorMessage } from '@/api/http';
import { templatesApi } from '@/api/templates';
import { fmtDateTime } from '@/lib/format';
import { confirm, toast } from '@/lib/ui';
import type { OaTemplate, TemplateType } from '@/types';
import { TemplateForm } from './TemplateForm';
import { TEMPLATE_TYPE_DISPLAY, TEMPLATE_TYPES, VERSION_DISPLAY, typeLabel } from './templateTypes';

export const TEMPLATES_KEY = ['templates'];

/** templates of a type together (display order), the default first, then the latest */
export function sortTemplates(templates: OaTemplate[]): OaTemplate[] {
  const typeIndex = (t: OaTemplate) => (t.type ? TEMPLATE_TYPES.indexOf(t.type) : TEMPLATE_TYPES.length);
  return [...templates].sort(
    (a, b) =>
      typeIndex(a) - typeIndex(b) ||
      Number(!!b.defaultTemplate) - Number(!!a.defaultTemplate) ||
      (b.dateCreation ?? '').localeCompare(a.dateCreation ?? ''),
  );
}

function TemplateVariables({ id }: { id: string }) {
  const { data } = useQuery({ queryKey: ['template-variables', id], queryFn: () => templatesApi.variables(id) });
  if (!data) return <Loader />;
  if (!data.length) return <NoContent>This template reads no variable.</NoContent>;
  return (
    <List spacing={4}>
      {data.map((v) => (
        <List.Item key={v}>
          <Code>{v}</Code>
        </List.Item>
      ))}
    </List>
  );
}

/**
 * every template of the application, one menu. Per type: any number of v1 (FreeMarker) and v2 (jinja, file service)
 * templates, one of them the default: the one rendered.
 */
export function TemplatesPage() {
  const [params, setParams] = useSearchParams();
  const type = (params.get('type') as TemplateType | null) ?? undefined;
  const queryClient = useQueryClient();
  const { data: types = [] } = useQuery({ queryKey: ['template-types'], queryFn: templatesApi.types });
  const { data: templates } = useQuery({
    queryKey: [...TEMPLATES_KEY, type ?? 'all'],
    queryFn: () => templatesApi.list(type),
  });
  const reload = () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
      reload();
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    }
  };

  const open = (template?: OaTemplate) =>
    openModal({
      title: template?.id ? `Template ${template.name}` : 'New template',
      size: 'lg',
      closeOnClickOutside: false,
      render: (close) => (
        <TemplateForm
          template={template}
          types={types}
          initialType={type}
          onSubmit={async (form) => {
            if (await run(() => templatesApi.save(form), 'Template saved')) close();
          }}
        />
      ),
    });

  const setDefault = (t: OaTemplate) =>
    t.id && run(() => templatesApi.setDefault(t.id!), `${t.name} is now the default ${typeLabel(t.type)} template`);

  const remove = async (t: OaTemplate) => {
    if (!t.id || t.defaultTemplate) return;
    if (await confirm(`Delete the template ${t.name ?? ''}?`)) {
      await run(() => templatesApi.delete(t.id!), 'Template deleted');
    }
  };

  const showVariables = (t: OaTemplate) =>
    t.id &&
    openModal({
      title: `Variables of ${t.name}`,
      size: 'md',
      render: () => <TemplateVariables id={t.id!} />,
    });

  const rows = sortTemplates(templates ?? []);

  return (
    <>
      <PageHeader
        title="Templates"
        description="Every type has one default template, v1 (FreeMarker) or v2 (Jinja): the one rendered."
        actions={
          <Button leftSection={<Icon icon="plus" />} onClick={() => open()}>
            New template
          </Button>
        }
      />
      <Group mb="md">
        <Select
          aria-label="type"
          placeholder="All types"
          clearable
          w={260}
          value={type ?? null}
          onChange={(v) => setParams(v ? { type: v } : {})}
          data={TEMPLATE_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))}
        />
        {type && (
          <Text size="sm" c="dimmed">
            {TEMPLATE_TYPE_DISPLAY[type].description}
          </Text>
        )}
      </Group>
      {templates && (
        <Table.ScrollContainer minWidth={640}>
          <Table className="clickable-rows">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Version</Table.Th>
                <Table.Th visibleFrom="md">Updated</Table.Th>
                <Table.Th w={110} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {!rows.length && (
                <EmptyRow
                  colSpan={5}
                  icon="file-code"
                  title="No template"
                  description="The bundled templates are added at startup."
                />
              )}
              {rows.map((t) => {
                const version = t.version ? VERSION_DISPLAY[t.version] : undefined;
                return (
                  <Table.Tr key={t.id} onClick={() => open(t)}>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Text size="sm" fw={500}>
                          {t.name}
                        </Text>
                        {t.defaultTemplate && (
                          <Badge size="xs" variant="light" color="green">
                            Default
                          </Badge>
                        )}
                      </Group>
                      {t.description && (
                        <Text size="xs" c="dimmed">
                          {t.description}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>{typeLabel(t.type)}</Table.Td>
                    <Table.Td>
                      <StatusBadge value={t.version} label={version?.label} color={version?.color} />
                    </Table.Td>
                    <Table.Td visibleFrom="md" c="dimmed">
                      {fmtDateTime(t.updatedDate ?? t.dateCreation)}
                    </Table.Td>
                    <Table.Td>
                      <RowActions
                        inline={[
                          {
                            label: 'Set as default',
                            icon: 'star',
                            color: 'yellow',
                            hidden: t.defaultTemplate,
                            onClick: () => setDefault(t),
                          },
                          { label: 'Download', icon: 'download', onClick: () => templatesApi.download(t) },
                        ]}
                        groups={[
                          [
                            { label: 'Edit / replace the file', icon: 'edit', onClick: () => open(t) },
                            {
                              label: 'Variables',
                              icon: 'file-code',
                              hidden: t.version !== 'V2',
                              onClick: () => showVariables(t),
                            },
                          ],
                          [
                            {
                              label: t.defaultTemplate ? 'Delete (make another one the default first)' : 'Delete',
                              icon: 'trash',
                              color: 'red',
                              disabled: t.defaultTemplate,
                              onClick: () => remove(t),
                            },
                          ],
                        ]}
                      />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </>
  );
}
