import MDEditor from '@uiw/react-md-editor';

/** renders markdown (github flavoured) */
export function Markdown({ source }: { source?: string | null }) {
  return (
    <div data-color-mode="light">
      <MDEditor.Markdown source={source ?? ''} style={{ background: 'transparent' }} />
    </div>
  );
}

/** markdown editor with live side-by-side preview */
export function MarkdownEditor({
  value,
  onChange,
  height = '60vh',
}: {
  value: string;
  onChange: (v: string) => void;
  height?: string | number;
}) {
  return (
    <div data-color-mode="light">
      <MDEditor value={value} onChange={(v) => onChange(v ?? '')} height={height} preview="live" />
    </div>
  );
}
