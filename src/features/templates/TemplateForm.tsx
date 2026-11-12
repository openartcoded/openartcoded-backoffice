import { useState } from 'react';
import { Alert, Button, Checkbox, Group, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { FilePicker } from '@/components/files';
import { Icon } from '@/components/Icon';
import type { OaTemplate, TemplateForm as TemplateFormValues, TemplateType, TemplateTypeInfo } from '@/types';
import { TEMPLATE_TYPES, typeLabel } from './templateTypes';

/**
 * adds a template (no template given) or overwrites one: rename, replace its file, switch its version.
 * The type of an existing template never changes.
 */
export function TemplateForm({
  template,
  types,
  initialType,
  onSubmit,
  onEditSource,
}: {
  template?: OaTemplate;
  types: TemplateTypeInfo[];
  initialType?: TemplateType;
  onSubmit: (form: TemplateFormValues) => Promise<void>;
  /** a jinja template: opens the source editor (with preview) */
  onEditSource?: () => void;
}) {
  const editing = !!template?.id;
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [type, setType] = useState<TemplateType | null>(template?.type ?? initialType ?? null);
  // new templates are v2 (jinja) unless asked otherwise
  const [v1, setV1] = useState(template?.version === 'V1');
  const [makeDefault, setMakeDefault] = useState(false);
  const [file, setFile] = useState<File>();
  const [submitting, setSubmitting] = useState(false);

  const info = types.find((t) => t.type === type);
  const versionChanged = editing && (template?.version === 'V1') !== v1;
  // a file is needed for a new template, or to switch the version (the content must match it)
  const fileRequired = !editing || versionChanged;
  const valid = !!name.trim() && !!type && (!fileRequired || !!file);

  const submit = async () => {
    if (!valid || !type) return;
    setSubmitting(true);
    try {
      await onSubmit({
        id: template?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        v1,
        makeDefault,
        file,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack>
      <TextInput label="Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
      <Textarea
        label="Description"
        autosize
        minRows={2}
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
      />
      <Select
        label="Type"
        required
        disabled={editing}
        value={type}
        onChange={(v) => setType(v as TemplateType | null)}
        data={TEMPLATE_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))}
        allowDeselect={false}
      />
      <Checkbox
        label="FreeMarker template (v1)"
        description={
          v1
            ? 'Rendered by the backend, like the templates before the file service.'
            : 'Unchecked: a Jinja (MiniJinja) template, stored and rendered by the file service.'
        }
        checked={v1}
        onChange={(e) => setV1(e.currentTarget.checked)}
      />
      {!template?.defaultTemplate && (
        <Checkbox
          label="Use as default"
          description="The default template of a type is the one rendered."
          checked={makeDefault}
          onChange={(e) => setMakeDefault(e.currentTarget.checked)}
        />
      )}
      {!v1 && info && (
        <Text size="sm" c="dimmed">
          The file is uploaded as <b>{info.extension}</b>
          {info.output === 'TEXT' ? ', which also sets the content type of the rendering.' : '.'}
        </Text>
      )}
      <FilePicker
        label={fileRequired ? 'Drop the template file here or click to select' : 'Drop a new file to replace it'}
        files={file ? [file] : undefined}
        onFiles={(files) => setFile(files[0])}
      />
      {editing && file && (
        <Alert color="yellow" icon={<Icon icon="exclamation-triangle" />}>
          What uses this template (e.g. an invoice generated again) will render with the new file.
        </Alert>
      )}
      <Group justify={onEditSource ? 'space-between' : 'flex-end'}>
        {onEditSource && (
          <Button variant="light" leftSection={<Icon icon="pen" />} onClick={onEditSource}>
            Edit the template (with preview)
          </Button>
        )}
        <Button leftSection={<Icon icon="save" />} disabled={!valid} loading={submitting} onClick={submit}>
          Save
        </Button>
      </Group>
    </Stack>
  );
}
