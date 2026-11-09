import { useState } from 'react';
import { Button, Group, Select, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { cacheApi } from '@/api/misc';
import { toast } from '@/lib/ui';

export function CacheForm() {
  const { data: names = [] } = useQuery({ queryKey: ['caches'], queryFn: cacheApi.findAll });
  const [cache, setCache] = useState<string | null>(null);

  const clear = async () => {
    if (!cache) return;
    const res = await cacheApi.clear(cache);
    toast.success(res.message);
  };

  return (
    <Stack>
      <Select label="Cache" placeholder="--Select--" data={names} value={cache} onChange={setCache} />
      <Group justify="flex-end">
        <Button onClick={clear} disabled={!cache}>
          Submit
        </Button>
      </Group>
    </Stack>
  );
}
