import { Fragment, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Group,
  Menu,
  Paper,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  type MantineColor,
  type MantineSpacing,
  type TableTdProps,
} from '@mantine/core';
import { Icon } from './Icon';
import { fmtCurrency } from '@/lib/format';

/**
 * Header of every page: title, short description and the main actions as visible buttons.
 * Also sets the document title.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  documentTitle,
  mb = 'lg',
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
  documentTitle?: string;
  mb?: MantineSpacing;
}) {
  const navigate = useNavigate();
  const docTitle = documentTitle ?? (typeof title === 'string' ? title : undefined);
  useEffect(() => {
    if (docTitle) document.title = docTitle;
  }, [docTitle]);

  return (
    <Stack gap={4} mb={mb}>
      {back && (
        <Anchor size="sm" c="dimmed" onClick={() => navigate(back.to)} w="fit-content">
          <Group gap={6}>
            <Icon icon="arrow-left" size="xs" />
            {back.label}
          </Group>
        </Anchor>
      )}
      <Group justify="space-between" align="flex-start" gap="sm">
        <div style={{ minWidth: 0 }}>
          <Title order={2} fz="h3" fw={600}>
            {title}
          </Title>
          {description && (
            <Text c="dimmed" size="sm" mt={2}>
              {description}
            </Text>
          )}
        </div>
        {actions && <Group gap="xs">{actions}</Group>}
      </Group>
    </Stack>
  );
}

/** neutral empty state, used in tables and lists */
export function EmptyState({
  title = 'Nothing here yet',
  description,
  icon = 'folder-open',
  action,
}: {
  title?: string;
  description?: ReactNode;
  icon?: string;
  action?: ReactNode;
}) {
  return (
    <Stack align="center" gap={6} py="xl">
      <ThemeIcon variant="light" color="gray" size="xl" radius="xl">
        <Icon icon={icon} />
      </ThemeIcon>
      <Text fw={500}>{title}</Text>
      {description && (
        <Text size="sm" c="dimmed" ta="center" maw={420}>
          {description}
        </Text>
      )}
      {action}
    </Stack>
  );
}

/** a row of a table spanning all the columns with an empty state */
export function EmptyRow({ colSpan, ...props }: { colSpan: number } & Parameters<typeof EmptyState>[0]) {
  return (
    <Table.Tr>
      <Table.Td colSpan={colSpan}>
        <EmptyState {...props} />
      </Table.Td>
    </Table.Tr>
  );
}

const STATUS_COLORS: Record<string, MantineColor> = {
  // peppol
  OLD: 'gray',
  NOT_SENT: 'yellow',
  PROCESSING: 'blue',
  SUCCESS: 'green',
  // tasks
  FAILURE: 'red',
  UNKNOWN: 'gray',
  // contracts
  NOT_STARTED_YET: 'gray',
  ONGOING: 'green',
  DONE: 'gray',
  // posts
  DRAFT: 'gray',
  IN_PROGRESS: 'blue',
  PENDING: 'yellow',
  CANCELLED: 'red',
  // priorities
  LOW: 'gray',
  MEDIUM: 'blue',
  HIGH: 'orange',
  URGENT: 'red',
};

export const humanize = (value?: string | null) =>
  value ? (value.charAt(0) + value.slice(1).toLowerCase()).replace(/_/g, ' ') : '';

/** backend enums (NOT_SENT, ONGOING...) shown as a readable, colored badge */
export function StatusBadge({
  value,
  label,
  color,
}: {
  value?: string | null;
  label?: ReactNode;
  color?: MantineColor;
}) {
  if (!value) return null;
  return (
    <Badge variant="light" color={color ?? STATUS_COLORS[value] ?? 'gray'} radius="sm" tt="none" fw={500}>
      {label ?? humanize(value)}
    </Badge>
  );
}

/** amount right aligned with tabular figures, so columns of numbers line up */
export function MoneyCell({ value, strong, ...props }: { value?: number | null; strong?: boolean } & TableTdProps) {
  return (
    <Table.Td
      ta="right"
      style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
      fw={strong ? 600 : undefined}
      {...props}
    >
      {fmtCurrency(value)}
    </Table.Td>
  );
}

export interface RowAction {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  hidden?: boolean;
  color?: MantineColor;
}

/**
 * actions of a table row: the frequent ones as icon buttons,
 * the others in a menu grouped by section (destructive actions in the last group)
 */
export function RowActions({ inline = [], groups = [] }: { inline?: RowAction[]; groups?: RowAction[][] }) {
  const visibleGroups = groups.map((g) => g.filter((a) => !a.hidden)).filter((g) => g.length);
  return (
    <Group gap={2} wrap="nowrap" justify="flex-end" onClick={(e) => e.stopPropagation()}>
      {inline
        .filter((a) => !a.hidden)
        .map((a) => (
          <Tooltip key={a.label} label={a.label} openDelay={300}>
            <ActionIcon
              variant="subtle"
              color={a.color ?? 'gray'}
              disabled={a.disabled}
              onClick={a.onClick}
              aria-label={a.label}
            >
              <Icon icon={a.icon} />
            </ActionIcon>
          </Tooltip>
        ))}
      {!!visibleGroups.length && (
        <Menu position="bottom-end" shadow="md" width={220} withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label="more actions">
              <Icon icon="ellipsis-v" />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {visibleGroups.map((group, i) => (
              <Fragment key={i}>
                {i > 0 && <Menu.Divider />}
                {group.map((a) => (
                  <Menu.Item
                    key={a.label}
                    leftSection={<Icon icon={a.icon} />}
                    color={a.color}
                    disabled={a.disabled}
                    onClick={a.onClick}
                  >
                    {a.label}
                  </Menu.Item>
                ))}
              </Fragment>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );
}

/** titled block of a form (details, bill to, lines...) */
export function FormSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end" gap="xs">
        <div>
          <Text fw={600}>{title}</Text>
          {description && (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          )}
        </div>
        {actions}
      </Group>
      {children}
    </Stack>
  );
}

/** label + value, used for read only summaries (totals, dates...) */
export function Stat({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={strong ? 700 : 500} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value ?? '—'}
      </Text>
    </div>
  );
}

/** footer of a form in a drawer: stays visible at the bottom while scrolling */
export function StickyFooter({ children }: { children: ReactNode }) {
  return (
    <Group className="sticky-footer" justify="space-between" wrap="wrap" gap="xs">
      {children}
    </Group>
  );
}

/** key figure of the dashboard */
export function KpiCard({
  label,
  value,
  hint,
  icon,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: string;
  onClick?: () => void;
}) {
  return (
    <Paper withBorder p="md" className={onClick ? 'kpi-card clickable' : 'kpi-card'} onClick={onClick}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" fw={500}>
            {label}
          </Text>
          <Text fz={22} fw={700} mt={4} style={{ fontVariantNumeric: 'tabular-nums' }} truncate>
            {value ?? '—'}
          </Text>
          {hint && (
            <Text size="xs" c="dimmed" mt={2} truncate>
              {hint}
            </Text>
          )}
        </div>
        <ThemeIcon variant="light" size="lg" radius="md">
          <Icon icon={icon} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
}

/** card with a title, used for the dashboard widgets */
export function Panel({
  title,
  actions,
  children,
  p = 'md',
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  p?: string | number;
}) {
  return (
    <Paper withBorder>
      <Group justify="space-between" px="md" py="sm" className="border-bottom" gap="xs">
        <Text fw={600} size="sm">
          {title}
        </Text>
        {actions}
      </Group>
      <Box p={p}>{children}</Box>
    </Paper>
  );
}
