import { useState } from 'react';
import { Alert, Anchor, Autocomplete, Button, Checkbox, Code, Group, List, Loader, Paper, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { openModal } from '@/components/modal';
import { openDrawer } from '@/components/drawer';
import { tasksApi } from '@/api/misc';
import { fmtDate, fromInput, toInputDateTime } from '@/lib/format';
import { confirm, toast } from '@/lib/ui';
import type { ActionMetadata, ActionParameter, ReminderTask } from '@/types';
import { cloneTask, emptyTask, QUICK_DATES, quickDate } from './logic';

interface ParamValue {
  key: string;
  value: string;
  parameterType?: ActionParameter['parameterType'];
  required?: boolean;
}

const toParams = (params?: ActionParameter[] | null): ParamValue[] =>
  (params ?? []).map((p) => ({ key: p.key ?? '', value: p.value ?? '', parameterType: p.parameterType, required: p.required }));

export function CronHelp() {
  const [expr, setExpr] = useState('');
  const [valid, setValid] = useState<boolean | null>(null);
  const validate = async () => {
    setValid(null);
    setValid((await tasksApi.validateCron(expr)).valid);
  };
  return (
    <Stack gap="sm">
      <Group wrap="nowrap">
        <TextInput style={{ flex: 1 }} placeholder="Insert Cron expression to validate" value={expr} onChange={(e) => setExpr(e.currentTarget.value)} />
        <Button variant="outline" disabled={!expr} onClick={validate}>
          Validate
        </Button>
      </Group>
      {valid !== null && (
        <Text ta="right" c={valid ? 'green' : 'red'}>
          {valid ? 'Valid' : 'Invalid'}
        </Text>
      )}
      <Text>The string has six single space-separated time and date fields:</Text>
      <Code block>{`┌───────────── second (0-59)
│ ┌───────────── minute (0 - 59)
│ │ ┌───────────── hour (0 - 23)
│ │ │ ┌───────────── day of the month (1 - 31)
│ │ │ │ ┌───────────── month (1 - 12) (or JAN-DEC)
│ │ │ │ │ ┌───────────── day of the week (0 - 7)
│ │ │ │ │ │          (0 or 7 is Sunday, or MON-SUN)
│ │ │ │ │ │
* * * * * *`}</Code>
      <Text>The following rules apply:</Text>
      <List size="sm">
        <List.Item>
          A field may be an asterisk (<Code>*</Code>), which always stands for "first-last". For the "day of the month" or "day of the
          week" fields, a question mark (<Code>?</Code>) may be used instead of an asterisk.
        </List.Item>
        <List.Item>
          Ranges of numbers are expressed by two numbers separated with a hyphen (<Code>-</Code>). The specified range is inclusive.
        </List.Item>
        <List.Item>
          Following a range (or <Code>*</Code>) with <Code>/n</Code> specifies the interval of the number's value through the range.
        </List.Item>
        <List.Item>
          English names can also be used for the "month" and "day of week" fields. Use the first three letters of the particular day or
          month (case does not matter).
        </List.Item>
      </List>
      <Text>Example expressions:</Text>
      <List size="sm">
        <List.Item><Code>0 0 * * * *</Code> = the top of every hour of every day.</List.Item>
        <List.Item><Code>*/10 * * * * *</Code> = every ten seconds.</List.Item>
        <List.Item><Code>0 0 8-10 * * *</Code> = 8, 9 and 10 o'clock of every day.</List.Item>
        <List.Item><Code>0 0 6,19 * * *</Code> = 6:00 AM and 7:00 PM every day.</List.Item>
        <List.Item><Code>0 0/30 8-10 * * *</Code> = 8:00, 8:30, 9:00, 9:30, 10:00 and 10:30 every day.</List.Item>
        <List.Item><Code>0 0 9-17 * * MON-FRI</Code> = on the hour nine-to-five weekdays</List.Item>
        <List.Item><Code>0 0 0 25 12 ?</Code> = every Christmas Day at midnight</List.Item>
      </List>
    </Stack>
  );
}

export interface TaskFormProps {
  task: ReminderTask;
  actions: ActionMetadata[];
  blur?: boolean;
  onSave: (task: ReminderTask) => void;
  onDelete: (task: ReminderTask) => void;
  onClone: (task: ReminderTask) => void;
}

export function TaskForm({ task, actions, blur, onSave, onDelete, onClone }: TaskFormProps) {
  const form = useForm({
    initialValues: {
      title: task.title ?? '',
      description: task.description ?? '',
      hasAction: !!task.actionKey,
      actionKey: task.actionKey ?? '',
      customActionName: task.customActionName ?? '',
      actionParameters: toParams(task.actionParameters),
      hasSpecificDate: !!task.specificDate || !task.cronExpression,
      specificDate: toInputDateTime(task.specificDate),
      calendarDate: toInputDateTime(task.calendarDate),
      cronExpression: task.cronExpression ?? '',
      disabled: !!task.disabled,
      sendMail: !!task.sendMail,
      sendSms: !!task.sendSms,
      persistResult: !!task.persistResult,
      inAppNotification: !!task.inAppNotification,
    },
    validate: {
      title: (v) => (v?.trim() ? null : 'title is required'),
      description: (v) => (v?.trim() ? null : 'description is required'),
      actionParameters: {
        value: (v, values, path) => {
          const index = Number(path.split('.')[1]);
          return values.actionParameters[index]?.required && !v?.trim() ? 'required' : null;
        },
      },
    },
  });
  const v = form.values;
  // the quick date shown in the select, cleared when the date is changed by hand
  const [quick, setQuick] = useState<string | null>(null);
  const action = actions.find((a) => a.key === v.actionKey);
  const allowed = (key: string) => action?.allowedParameters?.find((p) => p.key === key);

  const selectAction = (title: string) => {
    const a = actions.find((x) => (x.title || x.key) === title);
    if (!a) return;
    form.setValues({
      actionKey: a.key ?? '',
      actionParameters: toParams(a.allowedParameters),
      customActionName: '',
      title: a.title ?? '',
      description: a.description ?? '',
      cronExpression: a.defaultCronValue || '0 0 * * * *',
      hasSpecificDate: false,
    });
  };

  const toggleAction = (checked: boolean) => {
    form.setFieldValue('hasAction', checked);
    if (!checked) {
      form.setValues({ actionParameters: [], actionKey: '', customActionName: '', description: '', title: '' });
    }
  };

  const toggleSpecificDate = (checked: boolean) => {
    form.setFieldValue('hasSpecificDate', checked);
    if (checked) form.setFieldValue('cronExpression', '');
    else form.setValues({ specificDate: '', calendarDate: '' });
  };

  const applyQuickDate = (option: string | null) => {
    setQuick(option);
    if (!option) return;
    form.setValues({ hasSpecificDate: true, cronExpression: '', specificDate: toInputDateTime(quickDate(option)) });
  };

  const invalidFields = Object.keys(form.errors);
  const canSubmit = form.isValid() && (v.hasSpecificDate ? !!v.specificDate : !!v.cronExpression.trim());

  const submit = form.onSubmit((values) => {
    const specificDate = values.hasSpecificDate ? fromInput(values.specificDate) : null;
    const calendarDate = values.hasSpecificDate ? fromInput(values.calendarDate) : null;
    onSave({
      id: task.id,
      title: values.title,
      description: values.description,
      actionKey: values.hasAction ? values.actionKey || null : null,
      customActionName: values.hasAction ? values.customActionName || null : null,
      actionParameters: values.hasAction
        ? values.actionParameters.map((p) => ({ key: p.key, value: p.value, parameterType: p.parameterType }))
        : null,
      inAppNotification: values.inAppNotification,
      disabled: values.disabled,
      sendMail: values.sendMail,
      sendSms: values.sendSms,
      persistResult: values.persistResult,
      cronExpression: !values.hasSpecificDate ? values.cronExpression : null,
      specificDate,
      calendarDate,
      lastExecutionDate: task.lastExecutionDate,
    });
  });

  return (
    <form onSubmit={submit} className={blur ? 'blur' : undefined}>
      <Stack gap="sm">
        {!v.hasAction && (
          <>
            <TextInput label="Title" placeholder="Title" data-autofocus {...form.getInputProps('title')} />
            <Textarea label="Description" placeholder="Description" autosize minRows={3} {...form.getInputProps('description')} />
          </>
        )}
        {v.hasAction && (
          <>
            <Autocomplete
              label="Action"
              placeholder="Search an action"
              data={actions.map((a) => a.title || a.key || '')}
              defaultValue={action?.title || action?.key || ''}
              onOptionSubmit={selectAction}
            />
            {action && (
              <Alert color="blue" icon={<Icon icon="info" />}>
                {action.description}
              </Alert>
            )}
            <TextInput label="Custom Title" placeholder="Enter a custom title" {...form.getInputProps('customActionName')} />
            {!!v.actionParameters.length && (
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Parameters
                </Text>
                {v.actionParameters.map((p, i) => {
                  const meta = allowed(p.key);
                  const type = meta?.parameterType ?? p.parameterType;
                  const props = form.getInputProps(`actionParameters.${i}.value`);
                  return (
                    <Paper key={p.key} bg="gray.0" p="xs">
                      <TextInput size="xs" value={p.key} disabled mb={4} />
                      {type === 'OPTION' ? (
                        <Select
                          size="xs"
                          placeholder="--Select--"
                          data={Object.entries(meta?.options ?? {}).map(([value, label]) => ({ value, label }))}
                          {...props}
                        />
                      ) : type === 'BIG_STRING' ? (
                        <Textarea
                          size="xs"
                          minRows={14}
                          autosize
                          ff="monospace"
                          placeholder="new java.util.ArrayList([1,2,3]).stream().mapToInt(i => parseInt(i)).sum()"
                          {...props}
                        />
                      ) : (
                        <TextInput size="xs" {...props} />
                      )}
                      {meta?.description && (
                        <Text size="xs" c="dimmed" mt={4}>
                          <Icon icon="info" /> {meta.description}
                        </Text>
                      )}
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </>
        )}

        {v.hasSpecificDate ? (
          <>
            <Select label="Quick date" placeholder="Pick a date quickly..." data={QUICK_DATES} value={quick} onChange={applyQuickDate} clearable />
            <TextInput
              type="datetime-local"
              label="Specific time"
              {...form.getInputProps('specificDate')}
              onChange={(e) => {
                setQuick(null);
                form.setFieldValue('specificDate', e.currentTarget.value);
              }}
            />
            <TextInput type="datetime-local" label="Calendar time" {...form.getInputProps('calendarDate')} />
          </>
        ) : (
          <TextInput
            label={
              <Group gap={4}>
                Cron
                <Anchor component="button" type="button" c="dark" onClick={() => openModal({ title: 'Cron Expression Helper', size: 'lg', render: () => <CronHelp /> })}>
                  <Icon icon="question-circle" />
                </Anchor>
              </Group>
            }
            placeholder="Cron Expression"
            {...form.getInputProps('cronExpression')}
          />
        )}
        {task.nextDate && <TextInput label="Next Date" value={fmtDate(task.nextDate, 'DD/MM/YYYY HH:mm:ss')} disabled />}
        {task.lastExecutionDate && <TextInput label="Last Execution" value={fmtDate(task.lastExecutionDate, 'DD/MM/YYYY HH:mm:ss')} disabled />}

        {!!invalidFields.length && (
          <Alert color="yellow">Invalid field: {JSON.stringify(invalidFields)}</Alert>
        )}

        <Group gap="md">
          <Checkbox label="Specific Date" checked={v.hasSpecificDate} onChange={(e) => toggleSpecificDate(e.currentTarget.checked)} />
          <Checkbox label="Has Action" checked={v.hasAction} onChange={(e) => toggleAction(e.currentTarget.checked)} />
          <Checkbox label="Disabled" {...form.getInputProps('disabled', { type: 'checkbox' })} />
          <Checkbox label="Mail" {...form.getInputProps('sendMail', { type: 'checkbox' })} />
          <Checkbox label="Sms" {...form.getInputProps('sendSms', { type: 'checkbox' })} />
          {v.hasAction && <Checkbox label="Persist result" {...form.getInputProps('persistResult', { type: 'checkbox' })} />}
          <Checkbox label="In App Notification" {...form.getInputProps('inAppNotification', { type: 'checkbox' })} />
        </Group>

        <Group justify="flex-end">
          <Button color="yellow" disabled={!task.id} onClick={() => onClone(task)}>
            Clone
          </Button>
          <Button
            color="red"
            disabled={!task.id}
            onClick={async () => (await confirm('Are you sure you want to delete this record?')) && onDelete(task)}
          >
            Delete
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            Submit
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function TaskFormLoader(props: Omit<TaskFormProps, 'actions'>) {
  const { data: actions } = useQuery({ queryKey: ['allowed-actions'], queryFn: tasksApi.allowedActions });
  if (!actions) return <Loader />;
  return <TaskForm {...props} actions={actions} />;
}

/** opens the task form (new task when no task given). onChange is called after save/delete */
export function openTaskForm(task: ReminderTask = emptyTask(), onChange?: () => void, blur?: boolean) {
  openDrawer({
    title: task.customActionName || task.title || 'New Task',
    size: 'xl',
    closeOnClickOutside: false,
    render: (close) => (
      <TaskFormLoader
        task={task}
        blur={blur}
        onSave={async (t) => {
          close();
          await tasksApi.save(t);
          toast.success('Task saved');
          onChange?.();
        }}
        onDelete={async (t) => {
          close();
          if (t.id) await tasksApi.delete(t.id);
          toast.success('Task deleted');
          onChange?.();
        }}
        onClone={(t) => {
          close();
          openTaskForm(cloneTask(t), onChange, blur);
        }}
      />
    ),
  });
}
