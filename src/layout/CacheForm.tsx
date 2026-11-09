import { useState } from 'react';
import { Button, Group, Loader, Paper, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { cacheApi } from '@/api/misc';
import { toast } from '@/lib/ui';

/** server side caches, each one can be cleared */
export function CacheForm() {
  const { data: names, isLoading } = useQuery({ queryKey: ['caches'], queryFn: cacheApi.findAll });
  const [clearing, setClearing] = useState<string | null>(null);

  const clear = async (name: string) => {
    setClearing(name);
    try {
      const res = await cacheApi.clear(name);
      toast.success(res.message || `${name} cleared`);
    } finally {
      setClearing(null);
    }
  };

  if (isLoading) return <Loader size="sm" />;
  if (!names?.length) {
    return (
      <Text size="sm" c="dimmed">
        No cache.
      </Text>
    );
  }
  return (
    <Paper withBorder>
      <Stack gap={0}>
        {names.map((name, i) => (
          <Group key={name} justify="space-between" px="md" py="xs" style={i ? { borderTop: '1px solid var(--mantine-color-default-border)' } : undefined}>
            <Group gap="sm">
              <Icon icon="database" color="var(--mantine-color-gray-6)" />
              <Text size="sm" ff="monospace">
                {name}
              </Text>
            </Group>
            <Button size="xs" variant="default" loading={clearing === name} onClick={() => clear(name)}>
              Clear
            </Button>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}
