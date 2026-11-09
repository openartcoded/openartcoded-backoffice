import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ActionIcon, Button, Code, FileInput, Group, Loader, ScrollArea, Stack } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/ui';
import { cvApi } from '@/api/misc';
import { saveBlob } from '@/api/http';
import { toast } from '@/lib/ui';

/** export / import the whole curriculum as json */
export function CvEditorPage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { data: cv } = useQuery({ queryKey: ['cv'], queryFn: cvApi.full });
  const [file, setFile] = useState<File | null>(null);


  if (!cv) return <Loader />;
  const json = JSON.stringify(cv, null, 2);

  const importCv = async () => {
    if (!file) return;
    try {
      await cvApi.update(JSON.parse(await file.text()));
      client.invalidateQueries({ queryKey: ['cv'] });
      navigate('/cv');
    } catch (e) {
      toast.error(`invalid curriculum: ${e}`);
    }
  };

  return (
    <>
      <PageHeader title="Import / export" description="The whole curriculum as JSON." back={{ to: '/cv', label: 'Curriculum' }} />
      <Stack>
        <Group align="flex-end">
          <FileInput style={{ flex: 1 }} label="Import" accept="application/json" value={file} onChange={setFile} />
          <Button onClick={importCv} disabled={!file}>
            Import
          </Button>
          <ActionIcon size="lg" variant="default" aria-label="export" onClick={() => saveBlob(new Blob([json], { type: 'application/json' }), `cv${Date.now()}.json`)}>
            <Icon icon="download" />
          </ActionIcon>
        </Group>
        <ScrollArea>
          <Code block>{json}</Code>
        </ScrollArea>
      </Stack>
    </>
  );
}
