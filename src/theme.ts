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
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  defaultRadius: 'sm',
  components: {
    Table: { defaultProps: { striped: false, highlightOnHover: true, withTableBorder: true, verticalSpacing: 6 } },
    Modal: { defaultProps: { centered: false } },
  },
});
