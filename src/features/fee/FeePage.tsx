import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ActionIcon, Alert, Badge, Button, Checkbox, ColorInput, Group, NumberInput, Pagination, Paper, Popover, Select, Stack, Switch, Table, Tabs, Text, TextInput, Textarea, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { BookmarkButton, ImportedInfo } from '@/components/common';
import { EmptyRow, MoneyCell, PageHeader, RowActions } from '@/components/ui';
import { FilePicker } from '@/components/files';
import { openMailForm } from '@/components/forms';
import { openModal } from '@/components/modal';
import { dossiersApi, feesApi, labelsApi } from '@/api/billing';
import { filesApi } from '@/api/files';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { useNotificationListener } from '@/hooks/notifications';
import { RegisteredEvent } from '@/lib/notificationBus';
import { dayjs, fmtDate, titleCase } from '@/lib/format';
import { confirm, toast } from '@/lib/ui';
import type { Dossier, Fee, FeeManualForm, FeeSearchCriteria, Label } from '@/types';
import { openFeeDetail, TagForm, tagColor } from './FeeDetail';

const PAGE_SIZE = 10;

const emptySearch = { id: '', tag: null as string | null, subject: '', body: '', dateAfter: '', dateBefore: '', hasPaymentProof: false };
type SearchValues = typeof emptySearch;

/** search form values -> criteria (empty fields are ignored, dates cover the whole day) */
export function toCriteria(v: SearchValues, base: FeeSearchCriteria): FeeSearchCriteria {
  return {
    ...base,
    id: v.id.trim() || null,
    tag: v.tag || null,
    subject: v.subject.trim() || null,
    body: v.body.trim() || null,
    hasPaymentProof: v.hasPaymentProof || null,
    dateBefore: v.dateBefore ? dayjs(v.dateBefore).hour(23).minute(59).toDate() : null,
    dateAfter: v.dateAfter ? dayjs(v.dateAfter).hour(1).minute(0).toDate() : null,
  };
}

/** filters above the table: the common ones visible, the rare ones in "More filters" */
export function FeeSearchForm({ tags, onSearch }: { tags: Label[]; onSearch: (v: SearchValues) => void }) {
  const form = useForm({ initialValues: emptySearch });
  const extra = [form.values.id, form.values.body, form.values.hasPaymentProof].filter(Boolean).length;
  const dirty = form.isDirty();
  return (
    <form onSubmit={form.onSubmit(onSearch)}>
      <Group gap="xs" align="flex-end" mb="md" wrap="wrap">
        <Select
          w={180}
          placeholder="All tags"
          aria-label="Tag"
          data={tags.map((t) => ({ value: t.name ?? '', label: titleCase(t.name) }))}
          clearable
          searchable
          {...form.getInputProps('tag')}
        />
        <TextInput w={220} placeholder="Subject" aria-label="Subject" leftSection={<Icon icon="search" />} {...form.getInputProps('subject')} />
        <TextInput w={150} type="date" aria-label="From" {...form.getInputProps('dateAfter')} />
        <TextInput w={150} type="date" aria-label="To" {...form.getInputProps('dateBefore')} />
        <Popover position="bottom-start" shadow="md" width={280}>
          <Popover.Target>
            <Button variant="default" rightSection={extra ? <Badge size="xs" circle>{extra}</Badge> : undefined}>
              More filters
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="xs">
              <TextInput label="Id" {...form.getInputProps('id')} />
              <TextInput label="Body contains" {...form.getInputProps('body')} />
              <Switch label="Has a payment proof" {...form.getInputProps('hasPaymentProof', { type: 'checkbox' })} />
            </Stack>
          </Popover.Dropdown>
        </Popover>
        <Button type="submit" variant="light">
          Search
        </Button>
        {dirty && (
          <Button
            variant="subtle"
            color="gray"
            onClick={() => {
              form.reset();
              onSearch(emptySearch);
            }}
          >
            Reset
          </Button>
        )}
      </Group>
    </form>
  );
}

function ProcessValidation({ fees: initial, labels, dossier, onSubmit }: { fees: Fee[]; labels: Label[]; dossier?: Dossier | null; onSubmit: (fees: Fee[]) => void }) {
  const [fees, setFees] = useState(initial);
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        These expenses will be added to the dossier {dossier?.name}.
      </Text>
      <Stack gap={0} className="bordered-list">
        {fees.map((f) => (
          <Group key={f.id} justify="space-between" px="sm" py={4}>
            <Group gap="xs">
              <Icon icon="circle" color={tagColor(labels, f.tag)} />
              {f.subject}
            </Group>
            <ActionIcon variant="subtle" color="red" onClick={() => setFees((list) => list.filter((x) => x.id !== f.id))} aria-label="remove">
              <Icon icon="times" />
            </ActionIcon>
          </Group>
        ))}
      </Stack>
      <Group justify="flex-end">
        <Button disabled={!fees.length} onClick={() => onSubmit(fees)}>
          Process {fees.length} expense(s)
        </Button>
      </Group>
    </Stack>
  );
}

export function ManualSubmitForm({ onSubmit }: { onSubmit: (form: FeeManualForm) => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  return (
    <Stack gap="sm">
      <TextInput label="Subject" data-autofocus value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />
      <Textarea label="Body" autosize minRows={3} value={body} onChange={(e) => setBody(e.currentTarget.value)} />
      <FilePicker multiple onFiles={(f) => setFiles((list) => [...list, ...f])} />
      {!!files.length && (
        <Stack gap={0} className="bordered-list">
          {files.map((f, i) => (
            <Group key={`${f.name}-${i}`} justify="space-between" px="sm" py={4}>
              <Text size="sm">{f.name}</Text>
              <ActionIcon variant="subtle" color="red" aria-label="remove file" onClick={() => setFiles((list) => list.filter((x) => x !== f))}>
                <Icon icon="times" />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      )}
      <Group justify="flex-end">
        <Button disabled={!subject.trim() || !body.trim() || !files.length} onClick={() => onSubmit({ subject, body, files })}>
          Submit
        </Button>
      </Group>
    </Stack>
  );
}

export function FeeTable({ archived, bookmarked }: { archived?: boolean; bookmarked?: boolean }) {
  const isAdmin = useIsAdmin();
  const demoMode = useDemoMode();
  const client = useQueryClient();
  // bookmarks are not filtered on the archived flag
  const base: FeeSearchCriteria = bookmarked ? { bookmarked: true } : { archived: !!archived, bookmarked: false };
  const [criteria, setCriteria] = useState<FeeSearchCriteria>(base);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Fee[]>([]);
  const [showTagForm, setShowTagForm] = useState(false);
  const { data: fees, refetch } = useQuery({ queryKey: ['fees', criteria, page], queryFn: () => feesApi.search(criteria, page - 1, PAGE_SIZE) });
  const { data: tags = [] } = useQuery({ queryKey: ['labels'], queryFn: labelsApi.findAll });
  const { data: activeDossier } = useQuery({ queryKey: ['active-dossier'], queryFn: dossiersApi.activeDossier });
  const selectable = !archived && !bookmarked && isAdmin;

  useNotificationListener(archived ? [] : [RegisteredEvent.NEW_FEE], () => refetch());

  const search = (c: FeeSearchCriteria) => {
    setCriteria(c);
    setSelected([]);
    setPage(1);
  };
  const isSelected = (f: Fee) => selected.some((s) => s.id === f.id);
  const toggle = (f: Fee) => setSelected((list) => (isSelected(f) ? list.filter((s) => s.id !== f.id) : [...list, f]));
  const content = fees?.content ?? [];
  const allSelected = !!content.length && content.every(isSelected);
  const toggleAll = () =>
    setSelected((list) => (allSelected ? list.filter((s) => !content.some((f) => f.id === s.id)) : [...list, ...content.filter((f) => !isSelected(f))]));

  const saveTag = async (tag: Label | null) => {
    setShowTagForm(false);
    if (!tag?.name) return;
    await feesApi.updateTag(selected.map((s) => s.id), tag.name);
    search(criteria);
    refetch();
  };

  const process = () =>
    openModal({
      title: `Process into dossier ${activeDossier?.name ?? ''}`,
      size: 'lg',
      closeOnClickOutside: false,
      render: (close) => (
        <ProcessValidation
          fees={selected}
          labels={tags}
          dossier={activeDossier}
          onSubmit={async (list) => {
            await dossiersApi.processFees(list.map((f) => f.id));
            close();
            setSelected([]);
            refetch();
            client.invalidateQueries({ queryKey: ['active-dossier'] });
          }}
        />
      ),
    });

  const deleteSelected = async () => {
    if (!(await confirm(`Delete ${selected.length} expense(s)?`))) return;
    for (const f of selected) await feesApi.delete(f.id);
    search(criteria);
    refetch();
  };

  const sendMail = async (fee: Fee) => openMailForm({ attachments: await filesApi.findByIds(fee.attachmentIds) });

  const toggleBookmark = async (fee: Fee) => {
    await feesApi.toggleBookmarked(fee.id);
    toast.success(fee.bookmarked ? 'Bookmark removed' : 'Bookmarked');
    refetch();
  };

  return (
    <div className="fill-column">
      <FeeSearchForm tags={tags} onSearch={(v) => search(toCriteria(v, base))} />

      {!!selected.length && (
        <Paper withBorder p="xs" mb="sm" bg="artcoded.0">
          <Group justify="space-between" gap="xs">
            <Text size="sm" fw={500}>
              {selected.length} selected
            </Text>
            <Group gap="xs">
              <Popover opened={showTagForm} onChange={setShowTagForm} position="bottom-end" shadow="md" width={280}>
                <Popover.Target>
                  <Button size="xs" variant="default" leftSection={<Icon icon="tag" />} onClick={() => setShowTagForm((o) => !o)}>
                    Set tag
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  <TagForm tags={tags} onSubmit={saveTag} hideCancel />
                </Popover.Dropdown>
              </Popover>
              <Tooltip label="No active dossier" disabled={!!activeDossier}>
                <Button size="xs" variant="default" leftSection={<Icon icon="check" />} disabled={!activeDossier} onClick={process}>
                  Process
                </Button>
              </Tooltip>
              <Button size="xs" variant="default" color="red" leftSection={<Icon icon="trash" />} onClick={deleteSelected}>
                Delete
              </Button>
              <Button size="xs" variant="subtle" color="gray" onClick={() => setSelected([])}>
                Clear
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      <div className="scroll-body">
        <Table.ScrollContainer minWidth={640}>
        <Table className="clickable-rows">
          <Table.Thead>
            <Table.Tr>
              {selectable && (
                <Table.Th w={40}>
                  <Checkbox aria-label="select all" checked={allSelected} indeterminate={!allSelected && content.some(isSelected)} disabled={!content.length} onChange={toggleAll} />
                </Table.Th>
              )}
              <Table.Th>Subject</Table.Th>
              <Table.Th w={150}>Tag</Table.Th>
              <Table.Th visibleFrom="md">Received</Table.Th>
              {archived && <Table.Th visibleFrom="md">Processed</Table.Th>}
              <Table.Th ta="right" visibleFrom="sm">
                Amount excl. VAT
              </Table.Th>
              <Table.Th visibleFrom="md" ta="center">
                Files
              </Table.Th>
              {isAdmin && <Table.Th w={80} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody className={demoMode ? 'blur' : undefined}>
            {!content.length && <EmptyRow colSpan={8} icon="money-bill-wave" title="No expenses" description="Expenses received by mail or submitted manually show up here." />}
            {content.map((f) => (
              <Table.Tr key={f.id} onClick={() => openFeeDetail(f, () => refetch())} bg={isSelected(f) ? 'artcoded.0' : undefined}>
                {selectable && (
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Checkbox aria-label="select" checked={isSelected(f)} onChange={() => toggle(f)} />
                  </Table.Td>
                )}
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <Text size="sm" lineClamp={1}>
                      {f.subject}
                    </Text>
                    <ImportedInfo imported={f.imported} date={f.importedDate} />
                  </Group>
                </Table.Td>
                <Table.Td>
                  <TagBadge tags={tags} tag={f.tag} />
                </Table.Td>
                <Table.Td visibleFrom="md">{fmtDate(f.date)}</Table.Td>
                {archived && <Table.Td visibleFrom="md">{fmtDate(f.archivedDate)}</Table.Td>}
                <MoneyCell value={f.priceHVAT} visibleFrom="sm" />
                <Table.Td visibleFrom="md" ta="center" c="dimmed">
                  {f.attachmentIds?.length || '—'}
                </Table.Td>
                {isAdmin && (
                  <Table.Td>
                    <Group gap={2} wrap="nowrap" justify="flex-end">
                      <RowActions inline={[{ label: 'Send by email', icon: 'envelope', onClick: () => sendMail(f) }]} />
                      <BookmarkButton bookmarked={f.bookmarked} onToggle={() => toggleBookmark(f)} />
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      </div>
      <Group justify="space-between" mt="sm">
        <Text size="sm" c="dimmed">
          {fees?.page.totalElements ?? 0} expense(s)
        </Text>
        {fees && fees.page.totalPages > 1 && <Pagination value={page} onChange={setPage} total={fees.page.totalPages} />}
      </Group>
    </div>
  );
}

/** tag of an expense, in the color of its label */
export function TagBadge({ tags, tag }: { tags: Label[]; tag?: string }) {
  if (!tag) return <Text size="sm" c="dimmed">—</Text>;
  return (
    <Badge variant="dot" color={tagColor(tags, tag)} radius="sm" tt="none" fw={500}>
      {titleCase(tag)}
    </Badge>
  );
}

/** labels (tags) of the expenses with their default price */
export function LabelsEditor() {
  const isAdmin = useIsAdmin();
  const client = useQueryClient();
  const { data: labels } = useQuery({ queryKey: ['labels'], queryFn: labelsApi.findAll });
  if (!labels) return null;
  return (
    <LabelsForm
      key={labels.map((l) => l.id).join()}
      labels={[...labels].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))}
      isAdmin={isAdmin}
      onSaved={(saved) => client.setQueryData(['labels'], saved)}
    />
  );
}

function LabelsForm({ labels, isAdmin, onSaved }: { labels: Label[]; isAdmin: boolean; onSaved: (l: Label[]) => void }) {
  const toRow = (l: Label) => ({
    id: l.id ?? null,
    name: l.name ?? '',
    colorHex: l.colorHex ?? '#000000',
    priceHVAT: l.priceHVAT ?? 0,
    vat: l.vat ?? 0,
    hidden: !!l.hidden,
    noDefaultPrice: !!l.noDefaultPrice,
  });
  const form = useForm({
    initialValues: { labels: labels.map(toRow) },
    validate: {
      labels: {
        name: (v, values, path) => {
          const row = values.labels[Number(path.split('.')[1])];
          if (!v) return 'required';
          // new labels: only uppercase alphanumeric characters
          return !row?.id && !/^[A-Z0-9]+$/.test(v) ? 'alphanumeric only' : null;
        },
        colorHex: (v) => (v ? null : 'required'),
      },
    },
  });
  const submit = form.onSubmit(async (v) => {
    const saved = await labelsApi.updateAll(
      v.labels.map(({ id, name, colorHex, priceHVAT, vat, hidden }) => ({ id, name, colorHex, priceHVAT: Number(priceHVAT), vat: Number(vat), hidden })),
    );
    toast.success('Labels saved');
    onSaved(saved);
  });
  return (
    <form onSubmit={submit}>
      {isAdmin && (
        <Group justify="space-between" mb="sm">
          <Text size="sm" c="dimmed">
            Default price and VAT applied when an expense gets the label.
          </Text>
          <Group gap="xs">
            <Button variant="default" leftSection={<Icon icon="plus" />} onClick={() => form.insertListItem('labels', toRow({}))}>
              Add label
            </Button>
            <Button type="submit" disabled={!form.isValid()}>
              Save
            </Button>
          </Group>
        </Group>
      )}
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Color</Table.Th>
            <Table.Th>Label</Table.Th>
            <Table.Th>Price HVAT</Table.Th>
            <Table.Th>VAT</Table.Th>
            {isAdmin && <Table.Th>Hidden</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {form.values.labels.map((l, i) => (
            <Table.Tr key={l.id ?? `new-${i}`}>
              <Table.Td>
                <ColorInput size="xs" w={140} disabled={!isAdmin} {...form.getInputProps(`labels.${i}.colorHex`)} />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size="xs"
                  disabled={!!l.id || !isAdmin}
                  {...form.getInputProps(`labels.${i}.name`)}
                  onChange={(e) => form.setFieldValue(`labels.${i}.name`, e.currentTarget.value.toUpperCase())}
                />
              </Table.Td>
              <Table.Td>
                <NumberInput size="xs" prefix="€ " decimalScale={2} disabled={l.noDefaultPrice || !isAdmin} {...form.getInputProps(`labels.${i}.priceHVAT`)} />
              </Table.Td>
              <Table.Td>
                <NumberInput size="xs" prefix="€ " decimalScale={2} disabled={l.noDefaultPrice || !isAdmin} {...form.getInputProps(`labels.${i}.vat`)} />
              </Table.Td>
              {isAdmin && (
                <Table.Td>
                  <Checkbox aria-label="hidden" {...form.getInputProps(`labels.${i}.hidden`, { type: 'checkbox' })} />
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </form>
  );
}

export function FeePage() {
  const { name } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const isAdmin = useIsAdmin();
  const tab = name ?? (isAdmin ? 'unprocessed' : 'processed');
  const { data: activeDossier } = useQuery({ queryKey: ['active-dossier'], queryFn: dossiersApi.activeDossier });

  const manualSubmit = () =>
    openModal({
      title: 'Add an expense',
      size: 'lg',
      closeOnClickOutside: false,
      render: (close) => (
        <ManualSubmitForm
          onSubmit={async (form) => {
            close();
            await feesApi.manualSubmit(form);
            toast.success('Expense added');
            client.invalidateQueries({ queryKey: ['fees'] });
          }}
        />
      ),
    });

  return (
    <>
      <PageHeader
        title="Expenses"
        description={activeDossier ? `Active dossier: ${activeDossier.name}` : undefined}
        actions={
          isAdmin && (
            <Button leftSection={<Icon icon="plus" />} onClick={manualSubmit}>
              Add expense
            </Button>
          )
        }
      />
      {isAdmin && !activeDossier && (
        <Alert color="yellow" icon={<Icon icon="exclamation-triangle" />} mb="md" title="No active dossier">
          Expenses can't be processed until a dossier is opened.
        </Alert>
      )}
      <Tabs className="page-tabs" value={tab} onChange={(v) => v && navigate(`/fee/${v}`)} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="unprocessed">Unprocessed</Tabs.Tab>
          <Tabs.Tab value="processed">Processed</Tabs.Tab>
          <Tabs.Tab value="bookmarks" leftSection={<Icon icon="star" />}>
            Bookmarked
          </Tabs.Tab>
          <Tabs.Tab value="labels" ml="auto" leftSection={<Icon icon="tag" />}>
            Labels
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="unprocessed">
          <FeeTable archived={false} />
        </Tabs.Panel>
        <Tabs.Panel value="processed">
          <FeeTable archived />
        </Tabs.Panel>
        <Tabs.Panel value="bookmarks">
          <FeeTable bookmarked />
        </Tabs.Panel>
        <Tabs.Panel value="labels">
          <LabelsEditor />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
