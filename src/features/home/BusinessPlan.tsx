import { useState } from 'react';
import {
  Button,
  Checkbox,
  Group,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { businessPlanApi } from '@/api/billing';
import { errorMessage } from '@/api/http';
import { Icon } from '@/components/Icon';
import { openModal } from '@/components/modal';
import { toast } from '@/lib/ui';
import type { BusinessPlanLanguage, BusinessPlanRequest } from '@/types';

/** what was typed last time (activity, loan), so the next plan starts from it */
const STORAGE_KEY = 'business-plan-form';

const emptyValues = {
  language: 'FR' as BusinessPlanLanguage,
  activity: '',
  loanAmount: '' as number | string,
  loanMonths: '' as number | string,
  loanRate: '' as number | string,
  loanPurpose: '',
  refresh: false,
};
type Values = typeof emptyValues;

function loadValues(): Values {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return saved ? { ...emptyValues, ...saved, refresh: false } : emptyValues;
  } catch {
    return emptyValues;
  }
}

function saveValues(values: Values) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...values, refresh: false }));
  } catch {
    // private mode, full storage: the form is just not remembered
  }
}

const num = (v: number | string) => (v === '' || v === null || v === undefined ? null : Number(v));

export function toBusinessPlanRequest(v: Values): BusinessPlanRequest {
  return {
    language: v.language,
    activity: v.activity.trim() || undefined,
    loanAmount: num(v.loanAmount),
    loanMonths: num(v.loanMonths),
    loanRate: num(v.loanRate),
    loanPurpose: v.loanPurpose.trim() || undefined,
  };
}

/** the business plan / plan financier / financieel plan for a bank, generated from the real figures */
export function BusinessPlanForm({ onDone }: { onDone?: () => void }) {
  const [generating, setGenerating] = useState(false);
  const form = useForm<Values>({
    initialValues: loadValues(),
    validate: {
      loanMonths: (v, values) =>
        num(values.loanAmount) && !num(v) ? 'How many months?' : num(v) !== null && num(v)! > 600 ? 'Max 600' : null,
    },
  });

  const submit = form.onSubmit(async (values) => {
    saveValues(values);
    setGenerating(true);
    try {
      await businessPlanApi.generate(toBusinessPlanRequest(values), values.refresh);
      onDone?.();
    } catch (e) {
      toast.error(`Could not generate the business plan: ${errorMessage(e)}`);
    } finally {
      setGenerating(false);
    }
  });

  return (
    <form onSubmit={submit}>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Built from your invoices and expenses: the progress over the years and during the current year, the expenses
          (exceptional ones apart), the projected results for the next three years and the financing. Amounts excluding
          VAT, results before tax. The layout is the &quot;Business plan&quot; template.
        </Text>
        <SegmentedControl
          data={[
            { value: 'FR', label: 'Français' },
            { value: 'NL', label: 'Nederlands' },
            { value: 'EN', label: 'English' },
          ]}
          {...form.getInputProps('language')}
        />
        <Textarea
          label="Activity"
          description="A few lines on what you do (printed as is, in the language of the plan)"
          autosize
          minRows={2}
          maxRows={6}
          {...form.getInputProps('activity')}
        />
        <Text size="sm" fw={500} mt="xs">
          Loan (optional)
        </Text>
        <SimpleGrid cols={{ base: 1, xs: 3 }}>
          <NumberInput
            label="Amount"
            suffix=" €"
            min={0}
            thousandSeparator=" "
            allowNegative={false}
            {...form.getInputProps('loanAmount')}
          />
          <NumberInput
            label="Months"
            min={1}
            max={600}
            allowDecimal={false}
            allowNegative={false}
            {...form.getInputProps('loanMonths')}
          />
          <NumberInput
            label="Rate"
            suffix=" %"
            min={0}
            decimalScale={2}
            allowNegative={false}
            {...form.getInputProps('loanRate')}
          />
        </SimpleGrid>
        <TextInput label="Purpose" placeholder="e.g. a company car" {...form.getInputProps('loanPurpose')} />
        <Group justify="space-between" mt="xs">
          <Checkbox
            label="Generate again"
            description="Ignore the cached pdf"
            {...form.getInputProps('refresh', { type: 'checkbox' })}
          />
          <Button type="submit" loading={generating} leftSection={<Icon icon="download" />}>
            Download PDF
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function openBusinessPlan() {
  openModal({
    title: 'Business plan',
    size: 'lg',
    closeOnClickOutside: false,
    render: (close) => <BusinessPlanForm onDone={close} />,
  });
}
