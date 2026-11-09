import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ActionIcon, Alert, Button, Checkbox, Collapse, ColorInput, Grid, Group, Menu, NumberInput, Pagination, Paper, Select, Stack, Table, Tabs, Text, TextInput, Textarea, UnstyledButton } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { BookmarkButton, FullscreenSection, ImportedInfo, PageTitle } from '@/components/common';
import { FilePicker } from '@/components/files';
import { openMailForm } from '@/components/forms';
import { openModal } from '@/components/modal';
import { dossiersApi, feesApi, labelsApi } from '@/api/billing';
import { filesApi } from '@/api/files';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { useNotificationListener } from '@/hooks/notifications';
import { RegisteredEvent } from '@/lib/notificationBus';
import { dayjs, fmtCurrency, fmtDateTime, titleCase } from '@/lib/format';
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

export function FeeSearchForm({ tags, onSearch }: { tags: Label[]; onSearch: (v: SearchValues) => void }) {
  const [opened, setOpened] = useState(true);
  const form = useForm({ initialValues: emptySearch });
  return (
    <Paper withBorder>
      <UnstyledButton w="100%" p="sm" onClick={() => setOpened((o) => !o)}>
        <Group justify="space-between">
          <Text fw={700}>Search Form</Text>
          <Icon icon={opened ? 'ellipsis-h' : 'eye'} />
        </Group>
      </UnstyledButton>
      <Collapse in={opened}>
        <form onSubmit={form.onSubmit(onSearch)}>
          <Stack gap="xs" p="sm" pt={0}>
            <Select label="Tag" placeholder="--Select--" data={tags.map((t) => ({ value: t.name ?? '', label: titleCase(t.name) }))} clearable {...form.getInputProps('tag')} />
            <TextInput label="Id" placeholder="Fee Id" {...form.getInputProps('id')} />
            <TextInput label="Subject like" {...form.getInputProps('subject')} />
            <TextInput label="Body like" {...form.getInputProps('body')} />
            <TextInput type="date" label="From" {...form.getInputProps('dateAfter')} />
            <TextInput type="date" label="To" {...form.getInputProps('dateBefore')} />
            <Checkbox label="Has Payment proof" {...form.getInputProps('hasPaymentProof', { type: 'checkbox' })} />
            <Group justify="flex-end">
              <Button type="submit">Submit</Button>
              <Button
                variant="outline"
                color="red"
                onClick={() => {
                  form.reset();
                  onSearch(emptySearch);
                }}
              >
                Reset
              </Button>
            </Group>
          </Stack>
        </form>
      </Collapse>
    </Paper>
  );
}

function ProcessValidation({ fees: initial, labels, dossier, onSubmit }: { fees: Fee[]; labels: Label[]; dossier?: Dossier | null; onSubmit: (fees: Fee[]) => void }) {
  const [fees, setFees] = useState(initial);
  return (
    <Stack>
      <Text fw={500}>Selected Fees (Dossier {dossier?.name})</Text>
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
          Submit
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
      title: `Processing Validation (Dossier ${activeDossier?.name ?? ''})`,
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
    if (!(await confirm('Are you sure you want to delete the selected fees?'))) return;
    for (const f of selected) await feesApi.delete(f.id);
    search(criteria);
    refetch();
  };

  const manualSubmit = () =>
    openModal({
      title: 'Manual Submit',
      size: 'lg',
      closeOnClickOutside: false,
      render: (close) => (
        <ManualSubmitForm
          onSubmit={async (form) => {
            close();
            await feesApi.manualSubmit(form);
            setSelected([]);
            refetch();
          }}
        />
      ),
    });

  const sendMail = async (fee: Fee) => openMailForm({ attachments: await filesApi.findByIds(fee.attachmentIds) });

  const toggleBookmark = async (fee: Fee) => {
    await feesApi.toggleBookmarked(fee.id);
    toast.success('Bookmark toggled. Reload...');
    refetch();
  };

  return (
    <>
      {!archived && !bookmarked && !activeDossier && (
        <Alert color="red" icon={<Icon icon="times" />} mb="sm">
          No active dossier!
        </Alert>
      )}
      <Group justify="space-between" mb="sm">
        {isAdmin && (
          <Text>
            Total Elements: <Text span c="red">{fees?.page.totalElements ?? 0}</Text>
          </Text>
        )}
        {!archived && isAdmin && (
          <Menu position="bottom-end">
            <Menu.Target>
              <Button variant="outline" leftSection={<Icon icon="exclamation" />}>
                Actions
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<Icon icon="dot-circle" />} disabled={showTagForm || !selected.length} onClick={() => setShowTagForm(true)}>
                Set Tag
              </Menu.Item>
              <Menu.Item leftSection={<Icon icon="cog" />} disabled={showTagForm || !selected.length || !activeDossier} onClick={process}>
                Process
              </Menu.Item>
              <Menu.Item leftSection={<Icon icon="times" />} disabled={showTagForm || !selected.length} onClick={deleteSelected}>
                Delete
              </Menu.Item>
              <Menu.Item leftSection={<Icon icon="sync" />} onClick={() => refetch()}>
                Reload
              </Menu.Item>
              <Menu.Item leftSection={<Icon icon="upload" />} disabled={showTagForm || selected.length > 0} onClick={manualSubmit}>
                Manual Submit
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
      {showTagForm && !!selected.length && (
        <Paper withBorder p="sm" mb="sm">
          <TagForm tags={tags} onSubmit={saveTag} />
        </Paper>
      )}
      <Grid>
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <FeeSearchForm tags={tags} onSearch={(v) => search(toCriteria(v, base))} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 9 }}>
          <Table.ScrollContainer minWidth={500}>
            <Table className={demoMode ? 'blur' : undefined}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={30} />
                  <Table.Th>Subject</Table.Th>
                  <Table.Th visibleFrom="md">Date received</Table.Th>
                  <Table.Th visibleFrom="md">Date archived</Table.Th>
                  <Table.Th visibleFrom="md">Price HVAT</Table.Th>
                  <Table.Th visibleFrom="md">Files</Table.Th>
                  {isAdmin && <Table.Th w={80} />}
                  {selectable && (
                    <Table.Th w={40}>
                      <Checkbox aria-label="select all" checked={allSelected} disabled={!content.length} onChange={toggleAll} />
                    </Table.Th>
                  )}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {!content.length && (
                  <Table.Tr>
                    <Table.Td colSpan={8}>No entries</Table.Td>
                  </Table.Tr>
                )}
                {content.map((f) => (
                  <Table.Tr key={f.id} className="clickable" onClick={() => openFeeDetail(f, () => refetch())}>
                    <Table.Td>
                      <Icon icon="circle" color={tagColor(tags, f.tag)} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap" justify="space-between">
                        <span>{f.subject}</span>
                        <ImportedInfo imported={f.imported} date={f.importedDate} />
                      </Group>
                    </Table.Td>
                    <Table.Td visibleFrom="md">{fmtDateTime(f.date)}</Table.Td>
                    <Table.Td visibleFrom="md">{fmtDateTime(f.archivedDate)}</Table.Td>
                    <Table.Td visibleFrom="md">{fmtCurrency(f.priceHVAT)}</Table.Td>
                    <Table.Td visibleFrom="md" ta="center">
                      {f.attachmentIds?.length}
                    </Table.Td>
                    {isAdmin && (
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        <Group gap={0} wrap="nowrap">
                          <ActionIcon variant="subtle" aria-label="send by mail" onClick={() => sendMail(f)}>
                            <Icon icon="mail-bulk" />
                          </ActionIcon>
                          <BookmarkButton bookmarked={f.bookmarked} onToggle={() => toggleBookmark(f)} />
                        </Group>
                      </Table.Td>
                    )}
                    {selectable && (
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        <Checkbox aria-label="select" checked={isSelected(f)} onChange={() => toggle(f)} />
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot visibleFrom="md">
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Group gap="xs">
                      {tags
                        .filter((t) => !t.hidden)
                        .map((t) => (
                          <Button
                            key={t.id ?? t.name}
                            variant="subtle"
                            size="compact-sm"
                            leftSection={<Icon icon="circle" color={t.colorHex} />}
                            onClick={() => search({ archived: !!archived, tag: t.name })}
                          >
                            {t.name?.toLowerCase()}
                          </Button>
                        ))}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </Table.ScrollContainer>
          {fees && fees.page.totalPages > 1 && (
            <Group justify="flex-end" mt="sm">
              <Pagination value={page} onChange={setPage} total={fees.page.totalPages} />
            </Group>
          )}
        </Grid.Col>
      </Grid>
    </>
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
        <Group justify="flex-end" mb="sm">
          <Button variant="outline" leftSection={<Icon icon="plus" />} onClick={() => form.insertListItem('labels', toRow({}))}>
            Add
          </Button>
          <Button type="submit" disabled={!form.isValid()}>
            Submit
          </Button>
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
  const isAdmin = useIsAdmin();
  const tab = name ?? (isAdmin ? 'unprocessed' : 'processed');

  useEffect(() => {
    document.title = 'Expenses';
  }, []);

  return (
    <>
      <PageTitle title="Expenses" />
      <Tabs value={tab} onChange={(v) => v && navigate(`/fee/${v}`)} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="unprocessed">Unprocessed</Tabs.Tab>
          <Tabs.Tab value="processed">Processed</Tabs.Tab>
          <Tabs.Tab value="bookmarks" leftSection={<Icon icon="star" color="orange" />}>
            Bookmarks
          </Tabs.Tab>
          <Tabs.Tab value="labels">Labels</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="unprocessed" pt="sm">
          <FullscreenSection>
            <FeeTable archived={false} />
          </FullscreenSection>
        </Tabs.Panel>
        <Tabs.Panel value="processed" pt="sm">
          <FullscreenSection>
            <FeeTable archived />
          </FullscreenSection>
        </Tabs.Panel>
        <Tabs.Panel value="bookmarks" pt="sm">
          <FullscreenSection>
            <FeeTable bookmarked />
          </FullscreenSection>
        </Tabs.Panel>
        <Tabs.Panel value="labels" pt="sm">
          <FullscreenSection>
            <LabelsEditor />
          </FullscreenSection>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
