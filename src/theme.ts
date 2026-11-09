import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'artcoded',
  colors: {
    // derived from the historical #3b5784 brand color
    artcoded: [
      '#eef3fa',
      '#dce4f0',
      '#b5c6e1',
      '#8ba7d2',
      '#688cc5',
      '#527bbe',
      '#4672bc',
      '#3b5784',
      '#33548f',
      '#26487f',
    ],
  },
  primaryShade: 7,
  fontFamily: '"Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  headings: { fontFamily: '"Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  defaultRadius: 'sm',
  components: {
    Table: {
      defaultProps: { highlightOnHover: true, withTableBorder: true, verticalSpacing: 'xs', horizontalSpacing: 'sm' },
      styles: {
        thead: { backgroundColor: 'var(--mantine-color-gray-0)' },
        th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-dimmed)', whiteSpace: 'nowrap' },
      },
    },
    Paper: { defaultProps: { radius: 'md' } },
    Card: { defaultProps: { radius: 'md', withBorder: true } },
    Modal: { defaultProps: { centered: false, radius: 'md' } },
  },
});
