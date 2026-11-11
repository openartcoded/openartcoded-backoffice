import { useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  Paper,
  SegmentedControl,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { EmptyRow } from '@/components/ui';
import { feesApi } from '@/api/billing';
import { errorMessage } from '@/api/http';
import { useDemoMode } from '@/auth/session';
import { fmtCurrency, fmtDate } from '@/lib/format';
import { toast } from '@/lib/ui';
import type { ExceptionalStatus, Fee } from '@/types';
import { openFeeDetail } from './FeeDetail';

export type ExceptionalFilter = 'review' | 'CONFIRMED' | 'DENIED' | 'all';

const priceTot = (f: Fee) => f.priceTot ?? (f.priceHVAT ?? 0) + (f.vat ?? 0);

export function matchesFilter(fee: Fee, filter: ExceptionalFilter) {
  if (filter === 'all') return true;
  if (filter === 'review') return !fee.exceptional;
  return fee.exceptional === filter;
}

function StatusBadge({ status }: { status?: ExceptionalStatus | null }) {
  if (status === 'CONFIRMED')
    return (
      <Badge color="orange" variant="light" size="sm">
        Exceptional
      </Badge>
    );
  if (status === 'DENIED')
    return (
      <Badge color="gray" variant="light" size="sm">
        Normal
      </Badge>
    );
  return (
    <Badge color="yellow" variant="outline" size="sm">
      To review
    </Badge>
  );
}

/**
 * The expenses far above the usual ones (taxes, one-off purchases): flagged as exceptional (apart in the business
 * plan) or normal. Several at once.
 */
export function ExceptionalExpenses() {
  const demoMode = useDemoMode();
  const client = useQueryClient();
  const [factor, setFactor] = useState<number | string>(5);
  const [minAmount, setMinAmount] = useState<number | string>(1000);
  const [debouncedFactor] = useDebouncedValue(Number(factor) || 5, 400);
  const [debouncedMin] = useDebouncedValue(Number(minAmount) || 0, 400);
  const [filter, setFilter] = useState<ExceptionalFilter>('review');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['fee-exceptional', debouncedFactor, debouncedMin],
    queryFn: () => feesApi.exceptional(debouncedFactor, debouncedMin),
    placeholderData: keepPreviousData,
  });

  const expenses = data?.expenses ?? [];
  const shown = expenses.filter((f) => matchesFilter(f, filter));
  const count = (f: ExceptionalFilter) => expenses.filter((e) => matchesFilter(e, f)).length;
  const allSelected = !!shown.length && shown.every((f) => selected.includes(f.id));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () =>
    setSelected((s) =>
      allSelected ? s.filter((id) => !shown.some((f) => f.id === id)) : [...new Set([...s, ...shown.map((f) => f.id)])],
    );

  const update = async (status: ExceptionalStatus | 'NONE') => {
    setSaving(true);
    try {
      await feesApi.updateExceptional(selected, status);
      toast.success(
        `${selected.length} expense(s) ${status === 'CONFIRMED' ? 'exceptional' : status === 'DENIED' ? 'normal' : 'to review'}`,
      );
      setSelected([]);
      client.invalidateQueries({ queryKey: ['fee-exceptional'] });
      client.invalidateQueries({ queryKey: ['fees'] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fill-column">
      <Paper withBorder p="sm" mb="sm">
        <Group justify="space-between" gap="sm" align="flex-end">
          <Text size="sm" c="dimmed" maw={520}>
            {data ? (
              <>
                Usual expense: {fmtCurrency(data.median)} (median, VAT incl.). Suspect from{' '}
                <b>{fmtCurrency(data.threshold)}</b>. Exceptional ones are shown apart in the business plan; the ones to
                review count as exceptional until you decide.
              </>
            ) : (
              'Expenses far above the usual ones (taxes, one-off purchases).'
            )}
          </Text>
          <Group gap="xs" wrap="nowrap">
            <NumberInput
              size="xs"
              w={90}
              label="× median"
              min={1}
              step={1}
              value={factor}
              onChange={setFactor}
              allowNegative={false}
            />
            <NumberInput
              size="xs"
              w={110}
              label="Min (€)"
              min={0}
              step={100}
              value={minAmount}
              onChange={setMinAmount}
              allowNegative={false}
              thousandSeparator=" "
            />
          </Group>
        </Group>
      </Paper>

      <Group justify="space-between" mb="sm" gap="xs">
        <SegmentedControl
          size="xs"
          value={filter}
          onChange={(v) => setFilter(v as ExceptionalFilter)}
          data={[
            { value: 'review', label: `To review (${count('review')})` },
            { value: 'CONFIRMED', label: `Exceptional (${count('CONFIRMED')})` },
            { value: 'DENIED', label: `Normal (${count('DENIED')})` },
            { value: 'all', label: 'All' },
          ]}
        />
        {isLoading && <Loader size="xs" />}
      </Group>

      {!!selected.length && (
        <Paper withBorder p="xs" mb="sm" bg="artcoded.0">
          <Group justify="space-between" gap="xs">
            <Text size="sm" fw={500}>
              {selected.length} selected
            </Text>
            <Group gap="xs">
              <Tooltip label="Taxes, one-off purchases: apart in the business plan" withArrow>
                <Button
                  size="xs"
                  color="orange"
                  leftSection={<Icon icon="exclamation-triangle" />}
                  loading={saving}
                  onClick={() => update('CONFIRMED')}
                >
                  Exceptional
                </Button>
              </Tooltip>
              <Tooltip label="Big, but a normal expense" withArrow>
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<Icon icon="check" />}
                  disabled={saving}
                  onClick={() => update('DENIED')}
                >
                  Normal
                </Button>
              </Tooltip>
              <Button size="xs" variant="subtle" disabled={saving} onClick={() => update('NONE')}>
                Reset
              </Button>
              <Button size="xs" variant="subtle" color="gray" onClick={() => setSelected([])}>
                Clear
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      <div className="scroll-body">
        <Table.ScrollContainer minWidth={520}>
          <Table className="clickable-rows">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>
                  <Checkbox
                    aria-label="select all"
                    checked={allSelected}
                    indeterminate={!allSelected && shown.some((f) => selected.includes(f.id))}
                    disabled={!shown.length}
                    onChange={toggleAll}
                  />
                </Table.Th>
                <Table.Th>Subject</Table.Th>
                <Table.Th visibleFrom="sm">Tag</Table.Th>
                <Table.Th visibleFrom="md">Date</Table.Th>
                <Table.Th ta="right">VAT incl.</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody className={demoMode ? 'blur' : undefined}>
              {!shown.length && (
                <EmptyRow
                  colSpan={6}
                  icon="money-bill-wave"
                  title="Nothing here"
                  description={filter === 'review' ? 'No big expense to review.' : 'No expense with this status.'}
                />
              )}
              {shown.map((f) => (
                <Table.Tr
                  key={f.id}
                  onClick={() => openFeeDetail(f, () => refetch())}
                  bg={selected.includes(f.id) ? 'artcoded.0' : undefined}
                >
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={`select ${f.subject}`}
                      checked={selected.includes(f.id)}
                      onChange={() => toggle(f.id)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1}>
                      {f.subject}
                    </Text>
                  </Table.Td>
                  <Table.Td visibleFrom="sm">
                    <Text size="sm" c="dimmed">
                      {f.tag ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td visibleFrom="md">{fmtDate(f.date)}</Table.Td>
                  <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {fmtCurrency(priceTot(f))}
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={f.exceptional} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </div>
    </div>
  );
}
