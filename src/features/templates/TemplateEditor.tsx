import { useEffect, useState, type KeyboardEvent } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Code,
  Grid,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  Textarea,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { errorMessage } from '@/api/http';
import { templatesApi } from '@/api/templates';
import { confirm, toast } from '@/lib/ui';
import type { OaTemplate, TemplateTypeInfo } from '@/types';
import { blobText, indent, parseContext, previewKind, type PreviewKind } from './editorLogic';
import { typeLabel } from './templateTypes';

interface Preview {
  kind: PreviewKind;
  /** object url of a pdf rendering */
  url?: string;
  /** html or text rendering */
  text?: string;
}

const EDITOR_HEIGHT = 'calc(100dvh - 190px)';
const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

/**
 * edits the source of a jinja (v2) template: saving overwrites it (what uses the template renders with the new
 * version), the preview renders the source being edited with mock data, without saving it.
 */
export function TemplateEditor({
  template,
  types,
  onSaved,
  onClose,
}: {
  template: OaTemplate;
  types: TemplateTypeInfo[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const info = types.find((t) => t.type === template.type);
  const extension = info?.extension ?? '.html';
  const { data: original, error: loadError } = useQuery({
    queryKey: ['template-source', template.id],
    queryFn: () => templatesApi.source(template.id!),
    enabled: !!template.id,
    gcTime: 0,
  });

  const [source, setSource] = useState<string>();
  // what is saved: the loaded source, then what the last save sent
  const [savedSource, setSavedSource] = useState<string>();
  useEffect(() => {
    if (original !== undefined && source === undefined) {
      setSource(original);
      setSavedSource(original);
    }
  }, [original, source]);
  const dirty = source !== undefined && source !== savedSource;

  const [contextText, setContextText] = useState('');
  const [mockLoading, setMockLoading] = useState(false);
  const [preview, setPreview] = useState<Preview>();
  const [previewError, setPreviewError] = useState<string>();
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<string | null>('preview');
  const { error: contextError } = parseContext(contextText);

  // the object url of a pdf preview is released when replaced
  useEffect(() => {
    const url = preview?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [preview]);

  const generateMock = async () => {
    setMockLoading(true);
    try {
      const mock = await templatesApi.mockContext({ source: source ?? '', extension });
      const text = JSON.stringify(mock, null, 2);
      setContextText(text);
      return text;
    } catch (e) {
      toast.error(errorMessage(e));
      return undefined;
    } finally {
      setMockLoading(false);
    }
  };

  const runPreview = async () => {
    if (source === undefined) return;
    // the mock data is made from the source the first time
    const text = contextText.trim() ? contextText : await generateMock();
    const { context, error } = parseContext(text ?? '');
    if (error) {
      setTab('data');
      return;
    }
    setPreviewing(true);
    setPreviewError(undefined);
    setTab('preview');
    try {
      const { blob, contentType } = await templatesApi.preview({
        id: template.id,
        type: template.type!,
        v1: false,
        source,
        extension,
        context,
      });
      const kind = previewKind(contentType || blob.type);
      if (kind === 'pdf') {
        setPreview({ kind, url: URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })) });
      } else {
        setPreview({ kind, text: await blobText(blob) });
      }
    } catch (e) {
      setPreviewError(errorMessage(e));
    } finally {
      setPreviewing(false);
    }
  };

  const save = async () => {
    if (source === undefined || !dirty || saving) return;
    setSaving(true);
    try {
      await templatesApi.save({
        id: template.id,
        name: template.name ?? 'template',
        description: template.description ?? undefined,
        type: template.type!,
        v1: false,
        makeDefault: false,
        file: new File([source], `${template.name ?? 'template'}${extension}`, { type: 'text/plain' }),
      });
      setSavedSource(source);
      queryClient.removeQueries({ queryKey: ['template-source', template.id] });
      queryClient.invalidateQueries({ queryKey: ['template-variables', template.id] });
      toast.success(`${template.name} saved: what uses it renders with this version`);
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const close = async () => {
    if (!dirty || (await confirm('Close without saving the changes?', { danger: true, confirmLabel: 'Close' }))) {
      onClose();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void save();
    } else if (mod && e.key === 'Enter') {
      e.preventDefault();
      void runPreview();
    } else if (e.key === 'Tab' && !mod && !e.altKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const next = indent(el.value, el.selectionStart, el.selectionEnd, e.shiftKey);
      setSource(next.value);
      requestAnimationFrame(() => {
        el.selectionStart = next.start;
        el.selectionEnd = next.end;
      });
    }
  };

  if (loadError) {
    return <Alert color="red">Could not load the template: {errorMessage(loadError)}</Alert>;
  }
  if (source === undefined) {
    return (
      <Group justify="center" p="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="wrap">
        <Group gap="xs">
          <Badge variant="light">{typeLabel(template.type)}</Badge>
          <Badge variant="light" color="blue">
            v2 · Jinja{extension}
          </Badge>
          {template.defaultTemplate && (
            <Badge variant="light" color="green">
              Default
            </Badge>
          )}
          {dirty ? (
            <Badge variant="dot" color="yellow">
              Unsaved changes
            </Badge>
          ) : (
            <Badge variant="dot" color="gray">
              Saved
            </Badge>
          )}
        </Group>
        <Group gap="xs">
          <Button
            variant="subtle"
            leftSection={<Icon icon="arrow-rotate-backward" />}
            disabled={!dirty}
            onClick={async () => {
              if (await confirm('Discard the changes since the last save?', { danger: true })) setSource(savedSource);
            }}
          >
            Discard changes
          </Button>
          <Button variant="default" leftSection={<Icon icon="eye" />} loading={previewing} onClick={runPreview}>
            Preview ({MOD}+Enter)
          </Button>
          <Button leftSection={<Icon icon="save" />} disabled={!dirty} loading={saving} onClick={save}>
            Save ({MOD}+S)
          </Button>
          <Button variant="subtle" color="gray" onClick={close}>
            Close
          </Button>
        </Group>
      </Group>
      {template.defaultTemplate && dirty && (
        <Alert color="yellow" icon={<Icon icon="exclamation-triangle" />} py={6}>
          This is the default {typeLabel(template.type)} template: saving changes what is rendered from now on. Check
          the preview first.
        </Alert>
      )}
      <Grid gutter="sm">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Textarea
            aria-label="template source"
            value={source}
            onChange={(e) => setSource(e.currentTarget.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            styles={{
              input: {
                height: EDITOR_HEIGHT,
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontSize: 13,
                lineHeight: 1.45,
                whiteSpace: 'pre',
                overflowWrap: 'normal',
                overflowX: 'auto',
                tabSize: 2,
              },
            }}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Tabs value={tab} onChange={setTab} keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="preview" leftSection={<Icon icon="eye" />}>
                Preview
              </Tabs.Tab>
              <Tabs.Tab value="data" leftSection={<Icon icon="file-code" />} color={contextError ? 'red' : undefined}>
                Preview data
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="preview" pt="xs">
              <PreviewPane
                preview={preview}
                error={previewError}
                loading={previewing}
                onPreview={runPreview}
                title={`preview of ${template.name}`}
              />
            </Tabs.Panel>
            <Tabs.Panel value="data" pt="xs">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Mock values of the variables the template reads (json). Edit them to preview other cases.
                  </Text>
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<Icon icon="arrow-rotate-forward" />}
                    loading={mockLoading}
                    onClick={async () => {
                      if (
                        !contextText.trim() ||
                        (await confirm('Replace the preview data by mock data made from the current source?'))
                      ) {
                        await generateMock();
                      }
                    }}
                  >
                    Make from the source
                  </Button>
                </Group>
                {contextError && (
                  <Text size="xs" c="red">
                    {contextError}
                  </Text>
                )}
                <Textarea
                  aria-label="preview data"
                  value={contextText}
                  placeholder='{ "invoice": { "total": 1210 } }: made from the source on the first preview'
                  onChange={(e) => setContextText(e.currentTarget.value)}
                  spellCheck={false}
                  error={!!contextError}
                  styles={{
                    input: {
                      height: `calc(${EDITOR_HEIGHT} - 80px)`,
                      fontFamily: 'var(--mantine-font-family-monospace)',
                      fontSize: 12,
                      whiteSpace: 'pre',
                    },
                  }}
                />
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

const frameStyle = (height: string) => ({
  width: '100%',
  height,
  border: '1px solid var(--mantine-color-default-border)',
  borderRadius: 4,
  background: 'white',
});

function PreviewPane({
  preview,
  error,
  loading,
  onPreview,
  title,
}: {
  preview?: Preview;
  error?: string;
  loading: boolean;
  onPreview: () => void;
  title: string;
}) {
  const height = `calc(${EDITOR_HEIGHT} - 50px)`;
  if (error) {
    return (
      <Alert color="red" icon={<Icon icon="exclamation-triangle" />} title="The template could not be rendered">
        <Code block style={{ whiteSpace: 'pre-wrap' }}>
          {error}
        </Code>
      </Alert>
    );
  }
  if (!preview) {
    return (
      <Stack align="center" justify="center" h={height} gap="xs">
        {loading ? (
          <Loader />
        ) : (
          <>
            <Text c="dimmed" size="sm">
              Render the source being edited with mock data, without saving it.
            </Text>
            <Button variant="light" leftSection={<Icon icon="eye" />} onClick={onPreview}>
              Preview
            </Button>
          </>
        )}
      </Stack>
    );
  }
  return (
    <Box pos="relative" style={{ opacity: loading ? 0.5 : 1 }}>
      {preview.kind === 'text' ? (
        <ScrollArea h={height}>
          <Code block style={{ whiteSpace: 'pre-wrap' }}>
            {preview.text}
          </Code>
        </ScrollArea>
      ) : preview.kind === 'html' ? (
        // the rendering runs no script
        <iframe title={title} srcDoc={preview.text} sandbox="" style={frameStyle(height)} />
      ) : (
        <iframe title={title} src={preview.url} style={frameStyle(height)} />
      )}
    </Box>
  );
}
