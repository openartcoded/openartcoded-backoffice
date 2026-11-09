import { useState } from 'react';
import { Alert, Loader, Stack, Text } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// pdf.js renders the pdf itself (like the pdf.js viewer used by the angular app),
// so it doesn't depend on the browser pdf plugin / "download pdf" settings
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

/** every page of a pdf, as wide as its container. Loaded lazily (see FileViewer) */
export default function PdfDocument({ file }: { file: Blob }) {
  const { ref, width } = useElementSize();
  const [pages, setPages] = useState(0);
  const [error, setError] = useState<string>();

  return (
    <div ref={ref}>
      {error ? (
        <Alert color="red" title="Could not display the pdf">
          {error}
        </Alert>
      ) : (
        <Document
          file={file}
          loading={<Loader />}
          onLoadSuccess={(pdf) => setPages(pdf.numPages)}
          onLoadError={(e) => setError(e.message)}
        >
          <Stack gap="sm">
            {width > 0 &&
              Array.from({ length: pages }, (_, i) => (
                <Page key={i} pageNumber={i + 1} width={width} className="pdf-page" />
              ))}
          </Stack>
        </Document>
      )}
      {pages > 1 && (
        <Text size="xs" c="dimmed" ta="right" mt={4}>
          {pages} pages
        </Text>
      )}
    </div>
  );
}
