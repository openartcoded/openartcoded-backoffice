import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { LineChart } from '@mantine/charts';
import { ActionIcon, Alert, Anchor, Button, Checkbox, Group, Loader, Menu, NavLink, Paper, Progress, Select, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageTitle } from '@/components/common';
import { openModal } from '@/components/modal';
import { financeApi, portfolioApi } from '@/api/misc';
import { errorMessage } from '@/api/http';
import { dayjs, fmtDate, fmtDateTime, fmtNumber } from '@/lib/format';
import { confirm } from '@/lib/ui';
import type { Portfolio, Tick } from '@/types';

const YAHOO_URL = 'https://finance.yahoo.com/quote/';

/** percentage between the price when added and the current price */
export const tickDelta = (priceWhenAdded: number, current: number) => ((current - priceWhenAdded) / priceWhenAdded) * 100;

/** chart rows from a yahoo chart result (null values are skipped) */
export function chartRows(quote: { timestamp?: number[]; indicators?: { quote?: { close?: number[]; high?: number[]; low?: number[] }[] } }) {
  const q = quote.indicators?.quote?.[0];
  return (quote.timestamp ?? [])
    .map((t, i) => ({ time: dayjs.unix(t).format('HH:mm'), close: q?.close?.[i], high: q?.high?.[i], low: q?.low?.[i] }))
    .filter((r) => r.close !== null && r.close !== undefined);
}

function PortfolioForm({ portfolio, onSubmit }: { portfolio: Portfolio; onSubmit: (p: Portfolio) => void }) {
  const [name, setName] = useState(portfolio.name ?? '');
  const [principal, setPrincipal] = useState(!!portfolio.principal);
  return (
    <Stack gap="sm">
      <TextInput label="Id" value={portfolio.id ?? ''} disabled />
      <TextInput label="Name" placeholder="Name (Minimum 4 characters)" data-autofocus value={name} onChange={(e) => setName(e.currentTarget.value)} />
      <TextInput label="Creation Date" value={fmtDateTime(portfolio.dateCreation)} disabled />
      <TextInput label="Updated Date" value={fmtDateTime(portfolio.updatedDate)} disabled />
      <Checkbox label="Current" checked={principal} onChange={(e) => setPrincipal(e.currentTarget.checked)} />
      <Group justify="flex-end">
        <Button disabled={name.length < 4} onClick={() => onSubmit({ id: portfolio.id, name, principal })}>
          Submit
        </Button>
      </Group>
    </Stack>
  );
}

function PortfolioSelect({ portfolios, value, onChange }: { portfolios: Portfolio[]; value?: string; onChange: (id: string) => void }) {
  return (
    <Select
      data={portfolios.map((p) => ({ value: p.id ?? '', label: p.name }))}
      value={value ?? null}
      onChange={(v) => v && onChange(v)}
      allowDeselect={false}
      placeholder="Portfolio"
    />
  );
}

export function PortfolioTab() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { data: portfolios } = useQuery({ queryKey: ['portfolios'], queryFn: portfolioApi.findAll });
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState('');
  const [sortAsc, setSortAsc] = useState<boolean | null>(null);
  const selected = portfolios?.find((p) => p.id === selectedId) ?? portfolios?.find((p) => p.principal);
  const ticks = selected?.ticks ?? [];
  const quotes = useQueries({
    queries: ticks.map((t) => ({
      queryKey: ['tick-price', t.symbol],
      queryFn: async () => (await financeApi.chart(t.symbol!, '1d', '1d')).chart.result[0].meta.regularMarketPrice as number,
      retry: false,
    })),
  });

  const reload = () => client.invalidateQueries({ queryKey: ['portfolios'] });

  const rows = useMemo(() => {
    const list = ticks.map((t, i) => {
      const q = quotes[i];
      const current = q?.data;
      return { tick: t, loading: !!q?.isLoading, error: q?.error, current, delta: current !== undefined ? tickDelta(t.priceWhenAdded, current) : undefined };
    });
    const filtered = filter.length < 2 ? list : list.filter((r) => r.tick.symbol?.toUpperCase().includes(filter.toUpperCase()));
    if (sortAsc === null) return filtered;
    return [...filtered].sort((a, b) => ((a.delta ?? 0) - (b.delta ?? 0)) * (sortAsc ? 1 : -1));
  }, [ticks, quotes, filter, sortAsc]);

  const errors = rows.filter((r) => r.error);

  const edit = (portfolio: Portfolio = { name: '' }) =>
    openModal({
      title: `Portfolio (${portfolio.name || 'New'})`,
      size: 'lg',
      render: (close) => (
        <PortfolioForm
          portfolio={portfolio}
          onSubmit={async (p) => {
            const saved = await portfolioApi.save(p);
            close();
            setSelectedId(saved.id);
            reload();
          }}
        />
      ),
    });

  const remove = async (p: Portfolio) => {
    if (await confirm(`Delete the portfolio ${p.name}?`)) {
      await portfolioApi.delete(p.id!);
      setSelectedId(undefined);
      reload();
    }
  };

  const deleteTick = async (t: Tick) => {
    await portfolioApi.deleteTick(selected!.id!, t.symbol!);
    reload();
  };

  if (!portfolios) return <Loader />;

  return (
    <Stack>
      {errors.map((e) => (
        <Alert key={e.tick.symbol} color="yellow" icon={<Icon icon="warning" />}>
          <Group justify="space-between">
            <Text size="sm">
              Could not get {e.tick.symbol}. Error: {errorMessage(e.error)}
            </Text>
            <Button size="xs" color="red" onClick={() => deleteTick(e.tick)}>
              Delete
            </Button>
          </Group>
        </Alert>
      ))}
      <Group justify="space-between">
        <PortfolioSelect portfolios={portfolios} value={selected?.id} onChange={setSelectedId} />
        <Menu position="bottom-end">
          <Menu.Target>
            <Button variant="outline" leftSection={<Icon icon="exclamation" />}>
              Actions
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<Icon icon="plus" />} onClick={() => edit()}>
              New
            </Menu.Item>
            <Menu.Item leftSection={<Icon icon="edit" />} disabled={!selected} onClick={() => selected && edit(selected)}>
              Edit
            </Menu.Item>
            <Menu.Item leftSection={<Icon icon="times" />} disabled={!selected} onClick={() => selected && remove(selected)}>
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      {selected && (
        <>
          <TextInput type="search" placeholder="Filter..." autoFocus value={filter} onChange={(e) => setFilter(e.currentTarget.value)} />
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Symbol</Table.Th>
                <Table.Th visibleFrom="md">Added Date</Table.Th>
                <Table.Th>Initial Price</Table.Th>
                <Table.Th>Current Price</Table.Th>
                <Table.Th>
                  <Group gap={4}>
                    Result
                    <ActionIcon variant="subtle" color="dark" size="xs" onClick={() => setSortAsc((s) => !s)} aria-label="sort by result">
                      <Icon icon={sortAsc ? 'arrow-up' : 'arrow-down'} />
                    </ActionIcon>
                  </Group>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {!rows.length && (
                <Table.Tr>
                  <Table.Td colSpan={5}>No entries</Table.Td>
                </Table.Tr>
              )}
              {rows.map((r) => (
                <Table.Tr key={r.tick.symbol} className="clickable" onClick={() => navigate(`/finance/ticks?symbol=${encodeURIComponent(r.tick.symbol ?? '')}`)}>
                  <Table.Td>{r.tick.symbol}</Table.Td>
                  <Table.Td visibleFrom="md">{fmtDate(r.tick.addedDate)}</Table.Td>
                  <Table.Td>{r.tick.priceWhenAdded}</Table.Td>
                  {r.loading ? (
                    <Table.Td colSpan={2}>
                      <Progress value={100} striped animated />
                    </Table.Td>
                  ) : (
                    <>
                      <Table.Td>{r.current}</Table.Td>
                      <Table.Td c={(r.delta ?? 0) >= 0 ? 'green' : 'red'}>{r.delta !== undefined ? `${fmtNumber(r.delta)}%` : ''}</Table.Td>
                    </>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  );
}

export function TicksTab() {
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const [input, setInput] = useState(params.get('symbol') ?? '');
  const [debounced] = useDebouncedValue(input, 300);
  const [symbol, setSymbol] = useState<string | null>(params.get('symbol'));
  const [portfolioId, setPortfolioId] = useState<string>();
  const { data: portfolios = [] } = useQuery({ queryKey: ['portfolios'], queryFn: portfolioApi.findAll });
  const results = useQuery({
    queryKey: ['tick-search', debounced],
    queryFn: () => financeApi.search(debounced),
    enabled: debounced.length >= 2 && debounced !== symbol,
  });
  const detail = useQuery({
    queryKey: ['tick-detail', symbol],
    queryFn: async () => (await financeApi.chart(symbol!, '1m', '60m')).chart.result[0],
    enabled: !!symbol,
  });
  const portfolio = portfolios.find((p) => p.id === portfolioId) ?? portfolios[0];
  const quote = detail.data;
  const inPortfolio = !!portfolio?.ticks?.some((t) => t.symbol === symbol);

  const select = (s: string) => {
    setSymbol(s);
    setInput(s);
    setParams({ symbol: s });
  };

  const updateTicks = async (ticks: Tick[]) => {
    if (!portfolio?.id) return;
    await detail.refetch();
    await portfolioApi.updateTicks(portfolio.id, ticks);
    client.invalidateQueries({ queryKey: ['portfolios'] });
  };

  const add = () =>
    quote &&
    updateTicks([...(portfolio?.ticks ?? []), { symbol: symbol!, currency: quote.meta.currency, priceWhenAdded: quote.meta.regularMarketPrice }]);
  const removeTick = () => updateTicks((portfolio?.ticks ?? []).filter((t) => t.symbol !== symbol));

  const delta = quote ? quote.meta.regularMarketPrice - quote.meta.previousClose : 0;
  const percentage = quote ? (delta / quote.meta.previousClose) * 100 : 0;

  return (
    <Stack>
      <TextInput type="search" placeholder="Search ticks" autoComplete="off" autoFocus value={input} onChange={(e) => setInput(e.currentTarget.value)} />
      {results.data && debounced !== symbol && (
        <Paper withBorder>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(results.data.quotes ?? []).map((q: any) => (
            <NavLink key={q.symbol} label={`${q.longname || q.shortname} (${q.symbol})`} onClick={() => select(q.symbol)} />
          ))}
        </Paper>
      )}
      {detail.isLoading && <Loader />}
      {quote && (
        <>
          <Group justify="space-between">
            {portfolios.length > 0 && <PortfolioSelect portfolios={portfolios} value={portfolio?.id} onChange={setPortfolioId} />}
            <Menu position="bottom-end">
              <Menu.Target>
                <Button variant="outline" leftSection={<Icon icon="exclamation" />}>
                  Actions
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<Icon icon="sync" />} onClick={() => detail.refetch()}>
                  Reload
                </Menu.Item>
                {portfolio && !inPortfolio && (
                  <Menu.Item leftSection={<Icon icon="plus" />} onClick={add}>
                    Add to portfolio
                  </Menu.Item>
                )}
                {portfolio && inPortfolio && (
                  <Menu.Item leftSection={<Icon icon="check" />} onClick={removeTick}>
                    Remove from portfolio
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
          <Paper withBorder p="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={2}>{quote.meta.symbol}</Title>
                <Text fw={700}>
                  {fmtNumber(quote.meta.regularMarketPrice)} {quote.meta.currency}{' '}
                  <Text span c={delta >= 0 ? 'green' : 'red'}>
                    {fmtNumber(delta)} ({fmtNumber(percentage)}%)
                  </Text>
                </Text>
              </div>
              <Anchor href={YAHOO_URL + symbol} target="_blank">
                Details (Yahoo Finance)
              </Anchor>
            </Group>
            <LineChart
              mt="md"
              h={400}
              data={chartRows(quote)}
              dataKey="time"
              withLegend
              withDots={false}
              curveType="linear"
              yAxisProps={{ domain: ['auto', 'auto'] }}
              valueFormatter={(v) => fmtNumber(v)}
              series={[
                { name: 'close', label: 'Close', color: 'artcoded.7' },
                { name: 'high', label: 'High', color: 'teal.5' },
                { name: 'low', label: 'Low', color: 'gray.5' },
              ]}
            />
          </Paper>
        </>
      )}
    </Stack>
  );
}

export function FinancePage() {
  const { name = 'portfolio' } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'Finance';
  }, []);
  return (
    <>
      <PageTitle title="Finance" />
      <Tabs value={name} onChange={(v) => v && navigate(`/finance/${v}`)} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="portfolio">Portfolio</Tabs.Tab>
          <Tabs.Tab value="ticks">Ticks</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="portfolio" pt="sm">
          <PortfolioTab />
        </Tabs.Panel>
        <Tabs.Panel value="ticks" pt="sm">
          <TicksTab />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
