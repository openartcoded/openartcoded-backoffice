import { useNavigate } from 'react-router';
import { Button } from '@mantine/core';
import { EmptyState, PageHeader } from '@/components/ui';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Page not found" />
      <EmptyState
        icon="search"
        title="This page doesn't exist"
        description="It may have been moved, or you don't have access to it."
        action={
          <Button mt="xs" onClick={() => navigate('/')}>
            Back to home
          </Button>
        }
      />
    </>
  );
}
