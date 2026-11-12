import { useSearchParams } from 'react-router';
import {
  Badge,
  Button,
  Code,
  Group,
  List,
  Loader,
  SegmentedControl,
  Select,
  Switch,
  Table,
  Text,
  TextInput,
  UnstyledButton,
  type TableThProps,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { NoContent } from '@/components/common';
import { openModal } from '@/components/modal';
import { EmptyRow, PageHeader, RowActions, StatusBadge } from '@/components/ui';
import { errorMessage } from '@/api/http';
import { templatesApi } from '@/api/templates';
import { fmtDateTime } from '@/lib/format';
import { confirm, toast } from '@/lib/ui';
import type { OaTemplate, TemplateType, TemplateVersion } from '@/types';
import { TemplateEditor } from './TemplateEditor';
import { TemplateForm } from './TemplateForm';
import { TEMPLATE_TYPE_DISPLAY, TEMPLATE_TYPES, VERSION_DISPLAY, typeLabel } from './templateTypes';

export const TEMPLATES_KEY = ['templates'];

export type SortKey = 'default' | 'name' | 'type' | 'version' | 'updated';
export interface TemplateSort {
  key: SortKey;
  desc: boolean;
}
/** default templates on top, then by type (display order), then the latest */
export const DEFAULT_SORT: TemplateSort = { key: 'default', desc: false };
const SORT_KEYS: SortKey[] = ['default', 'name', 'type', 'version', 'updated'];

const typeIndex = (t: OaTemplate) => {
  const index = t.type ? TEMPLATE_TYPES.indexOf(t.type) : -1;
  return index < 0 ? TEMPLATE_TYPES.length : index;
};
const updated = (t: OaTemplate) => t.updatedDate ?? t.dateCreation ?? '';
const byTypeThenLatest = (a: OaTemplate, b: OaTemplate) =>
  typeIndex(a) - typeIndex(b) || updated(b).localeCompare(updated(a));

const COMPARATORS: Record<Exclude<SortKey, 'default'>, (a: OaTemplate, b: OaTemplate) => number> = {
  name: (a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base', numeric: true }),
  type: (a, b) => typeIndex(a) - typeIndex(b),
  version: (a, b) => (a.version ?? '').localeCompare(b.version ?? ''),
  updated: (a, b) => updated(a).localeCompare(updated(b)),
};

/** sorted on a column (ties: by type, then the latest), or the default order: default templates on top */
export function sortTemplates(templates: OaTemplate[], sort: TemplateSort = DEFAULT_SORT): OaTemplate[] {
  return [...templates].sort((a, b) => {
    if (sort.key === 'default') {
      return Number(!!b.defaultTemplate) - Number(!!a.defaultTemplate) || byTypeThenLatest(a, b);
    }
    const compared = COMPARATORS[sort.key](a, b);
    return (sort.desc ? -compared : compared) || byTypeThenLatest(a, b);
  });
}

/** clicking a column: ascending, then descending, then back to the default order */
export function nextSort(sort: TemplateSort, key: Exclude<SortKey, 'default'>): TemplateSort {
  if (sort.key !== key) return { key, desc: false };
  return sort.desc ? DEFAULT_SORT : { key, desc: true };
}

export interface TemplateFilter {
  /** in the name, the description or the type */
  search?: string;
  version?: TemplateVersion | null;
  defaultOnly?: boolean;
}

export function filterTemplates(templates: OaTemplate[], { search, version, defaultOnly }: TemplateFilter) {
  const q = search?.trim().toLowerCase();
  return templates.filter(
    (t) =>
      (!version || t.version === version) &&
      (!defaultOnly || !!t.defaultTemplate) &&
      (!q || [t.name, t.description, t.type, typeLabel(t.type)].some((v) => v?.toLowerCase().includes(q))),
  );
}

function SortTh({
  label,
  sortKey,
  sort,
  onSort,
  ...props
}: {
  label: string;
  sortKey: Exclude<SortKey, 'default'>;
  sort: TemplateSort;
  onSort: (key: Exclude<SortKey, 'default'>) => void;
} & TableThProps) {
  const active = sort.key === sortKey;
  return (
    <Table.Th {...props} aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <UnstyledButton onClick={() => onSort(sortKey)} fw={600} fz="sm" aria-label={`sort by ${label.toLowerCase()}`}>
        <Group gap={4} wrap="nowrap">
          {label}
          <Icon
            icon={active ? (sort.desc ? 'arrow-down' : 'arrow-up') : 'arrows-up-down'}
            size="xs"
            style={{ opacity: active ? 1 : 0.35 }}
          />
        </Group>
      </UnstyledButton>
    </Table.Th>
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
  // filters and sort in the url: kept on reload / back
  const search = params.get('q') ?? '';
  const versionParam = params.get('version');
  const version: TemplateVersion | null = versionParam === 'V1' || versionParam === 'V2' ? versionParam : null;
  const defaultOnly = params.get('default') === 'true';
  const sortParam = params.get('sort') as SortKey | null;
  const sort: TemplateSort =
    sortParam && SORT_KEYS.includes(sortParam) ? { key: sortParam, desc: params.get('desc') === 'true' } : DEFAULT_SORT;
  const setParam = (values: Record<string, string | null | undefined>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(values).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        return next;
      },
      { replace: true },
    );
  const onSort = (key: Exclude<SortKey, 'default'>) => {
    const next = nextSort(sort, key);
    setParam(next.key === 'default' ? { sort: null, desc: null } : { sort: next.key, desc: next.desc ? 'true' : null });
  };
  const filtered = !!search.trim() || !!version || defaultOnly;
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

  /** only jinja (v2) templates are edited in the backoffice: a FreeMarker one is replaced by a file */
  const editSource = (t: OaTemplate) =>
    t.id &&
    t.version === 'V2' &&
    openModal({
      title: `Edit ${t.name}`,
      fullScreen: true,
      closeOnClickOutside: false,
      render: (close) => <TemplateEditor template={t} types={types} onSaved={reload} onClose={close} />,
    });

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
          onEditSource={
            template?.version === 'V2'
              ? () => {
                  close();
                  editSource(template);
                }
              : undefined
          }
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

  const rows = sortTemplates(filterTemplates(templates ?? [], { search, version, defaultOnly }), sort);

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
      <Group mb="md" gap="sm" align="center">
        <TextInput
          w={240}
          aria-label="search"
          placeholder="Search name, description, type"
          leftSection={<Icon icon="search" />}
          value={search}
          onChange={(e) => setParam({ q: e.currentTarget.value })}
        />
        <Select
          aria-label="type"
          placeholder="All types"
          clearable
          w={220}
          value={type ?? null}
          onChange={(v) => setParam({ type: v })}
          data={TEMPLATE_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))}
        />
        <SegmentedControl
          aria-label="version"
          size="xs"
          value={version ?? 'ALL'}
          onChange={(v) => setParam({ version: v === 'ALL' ? null : v })}
          data={[
            { value: 'ALL', label: 'All' },
            { value: 'V1', label: VERSION_DISPLAY.V1.label },
            { value: 'V2', label: VERSION_DISPLAY.V2.label },
          ]}
        />
        <Switch
          label="Default only"
          checked={defaultOnly}
          onChange={(e) => setParam({ default: e.currentTarget.checked ? 'true' : null })}
        />
        {sort.key !== 'default' && (
          <Button
            variant="subtle"
            size="xs"
            leftSection={<Icon icon="arrow-rotate-backward" />}
            onClick={() => setParam({ sort: null, desc: null })}
          >
            Default order
          </Button>
        )}
        {templates && (
          <Text size="sm" c="dimmed" ml="auto">
            {rows.length === templates.length ? `${rows.length}` : `${rows.length} of ${templates.length}`} templates
          </Text>
        )}
      </Group>
      {type && TEMPLATE_TYPE_DISPLAY[type] && (
        <Text size="sm" c="dimmed" mb="md">
          {TEMPLATE_TYPE_DISPLAY[type].description}
        </Text>
      )}
      {templates && (
        <Table.ScrollContainer minWidth={640}>
          <Table className="clickable-rows">
            <Table.Thead>
              <Table.Tr>
                <SortTh label="Name" sortKey="name" sort={sort} onSort={onSort} />
                <SortTh label="Type" sortKey="type" sort={sort} onSort={onSort} />
                <SortTh label="Version" sortKey="version" sort={sort} onSort={onSort} />
                <SortTh label="Updated" sortKey="updated" sort={sort} onSort={onSort} visibleFrom="md" />
                <Table.Th w={110} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {!rows.length && (
                <EmptyRow
                  colSpan={5}
                  icon="file-code"
                  title={filtered ? 'No template matches the filters' : 'No template'}
                  description={
                    filtered ? 'Change the search or the filters.' : 'The bundled templates are added at startup.'
                  }
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
                            label: 'Edit the template',
                            icon: 'pen',
                            hidden: t.version !== 'V2',
                            onClick: () => editSource(t),
                          },
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
                            { label: 'Rename / replace the file', icon: 'edit', onClick: () => open(t) },
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
