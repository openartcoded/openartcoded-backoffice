import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Code,
  Group,
  Image,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { JSONPath } from 'jsonpath-plus';
import QRCode from 'qrcode';
import { Icon } from '@/components/Icon';
import { CopyButton } from '@/components/common';
import { FilePicker } from '@/components/files';
import { toolboxApi } from '@/api/misc';
import { errorMessage } from '@/api/http';
import { toast } from '@/lib/ui';
import { b64ToUtf8, DEFAULT_JSON, DEFAULT_XML, generatePassword, utf8ToB64 } from './logic';

export function Base64Tool({ decode }: { decode?: boolean }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const submit = () => {
    try {
      setResult(decode ? b64ToUtf8(input) : utf8ToB64(input));
    } catch (e) {
      toast.error(String(e));
    }
  };
  return (
    <Stack gap="sm">
      <Textarea
        label={decode ? 'Text to decode' : 'Text to encode'}
        autosize
        minRows={8}
        value={input}
        onChange={(e) => setInput(e.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button disabled={!input} onClick={submit}>
          Submit
        </Button>
      </Group>
      {result && <Textarea autosize minRows={8} readOnly value={result} label="Result" />}
    </Stack>
  );
}

export function ImageEncoder() {
  const [file, setFile] = useState<File>();
  const [result, setResult] = useState('');
  const convert = () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setResult(reader.result as string);
    reader.readAsDataURL(file);
  };
  return (
    <Stack gap="sm">
      <FilePicker
        onFiles={(f) => setFile(f[0])}
        accept={['image/*']}
        files={file ? [file] : []}
        label="Image to convert"
      />
      <Group justify="flex-end">
        <Button disabled={!file} onClick={convert}>
          Convert
        </Button>
      </Group>
      {result && (
        <>
          <Textarea readOnly minRows={8} autosize maxRows={12} value={result} />
          <Image src={result} alt="encoded" fit="contain" mah={400} />
        </>
      )}
    </Stack>
  );
}

export function Base64Tools() {
  return (
    <Tabs defaultValue="decode" variant="outline">
      <Tabs.List justify="center">
        <Tabs.Tab value="decode">Decode</Tabs.Tab>
        <Tabs.Tab value="encode">Encode</Tabs.Tab>
        <Tabs.Tab value="image-encode">Image encode</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="decode" p="md">
        <Base64Tool decode />
      </Tabs.Panel>
      <Tabs.Panel value="encode" p="md">
        <Base64Tool />
      </Tabs.Panel>
      <Tabs.Panel value="image-encode" p="md">
        <ImageEncoder />
      </Tabs.Panel>
    </Tabs>
  );
}

export function PathFinder({ type }: { type: 'json' | 'xml' }) {
  const [expression, setExpression] = useState(type === 'json' ? '$.store.book[*].author' : '/store/book/author');
  const [data, setData] = useState(type === 'json' ? DEFAULT_JSON : DEFAULT_XML);
  const [result, setResult] = useState<unknown>(null);
  const run = async () => {
    try {
      if (type === 'json') {
        setResult(JSONPath({ path: expression, json: JSON.parse(data) }));
      } else {
        setResult(await toolboxApi.xpath(expression, data));
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Stack gap="sm">
      <Group wrap="nowrap">
        <TextInput
          style={{ flex: 1 }}
          placeholder="Enter JSONPath or XPath expression"
          value={expression}
          onChange={(e) => setExpression(e.currentTarget.value)}
        />
        <Button onClick={run} disabled={!expression || !data}>
          Run
        </Button>
      </Group>
      <Textarea
        label="Input Data"
        minRows={10}
        autosize
        maxRows={20}
        ff="monospace"
        value={data}
        onChange={(e) => setData(e.currentTarget.value)}
      />
      {result !== null && (
        <Code block className="pre-wrap">
          {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
        </Code>
      )}
    </Stack>
  );
}

export function PathFinderTools() {
  return (
    <Tabs defaultValue="json-path" variant="outline">
      <Tabs.List justify="center">
        <Tabs.Tab value="json-path">JSONPath</Tabs.Tab>
        <Tabs.Tab value="x-path">XPath</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="json-path" p="md">
        <PathFinder type="json" />
      </Tabs.Panel>
      <Tabs.Panel value="x-path" p="md">
        <PathFinder type="xml" />
      </Tabs.Panel>
    </Tabs>
  );
}

function useRdfMeta() {
  const languages = useQuery({ queryKey: ['rdf-languages'], queryFn: toolboxApi.allowedLanguages });
  const extensions = useQuery({ queryKey: ['rdf-extensions'], queryFn: toolboxApi.allowedExtensions });
  return { languages: languages.data ?? [], extensions: (extensions.data ?? []).map((e) => `.${e}`) };
}

/** accept map for the dropzone: any mime type, filtered on the allowed extensions */
const acceptExtensions = (extensions: string[]) =>
  extensions.length ? { 'application/octet-stream': extensions, 'text/plain': extensions } : undefined;

export function RdfFileToFile() {
  const { languages, extensions } = useRdfMeta();
  const [file, setFile] = useState<File>();
  const [lang, setLang] = useState<string | null>(null);
  const submit = async () => {
    if (!file || !lang) return;
    await toolboxApi.fileToFile(file, lang);
    setFile(undefined);
    setLang(null);
  };
  return (
    <Stack gap="sm">
      <FilePicker
        onFiles={(f) => setFile(f[0])}
        accept={acceptExtensions(extensions)}
        files={file ? [file] : []}
        label="Drop rdf File"
      />
      <Select label="Choose an output format" data={languages} value={lang} onChange={setLang} />
      <Group justify="flex-end">
        <Button disabled={!file || !lang} onClick={submit}>
          Convert
        </Button>
      </Group>
    </Stack>
  );
}

export function RdfStringToLang() {
  const { languages } = useRdfMeta();
  const [modelLang, setModelLang] = useState<string | null>(null);
  const [lang, setLang] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const submit = async () => {
    if (!modelLang || !lang) return;
    try {
      setResult(await toolboxApi.modelToLang(input, modelLang, lang));
    } catch (e) {
      toast.error(`error: ${errorMessage(e)}`);
    }
  };
  return (
    <Stack gap="sm">
      <Select label="Choose an input format" data={languages} value={modelLang} onChange={setModelLang} />
      <Select label="Choose an output format" data={languages} value={lang} onChange={setLang} />
      <Textarea
        label="Insert rdf"
        autosize
        minRows={8}
        value={input}
        onChange={(e) => setInput(e.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button disabled={!modelLang || !lang || !input} onClick={submit}>
          Convert
        </Button>
      </Group>
      {result && (
        <Code block className="pre-wrap">
          {result}
        </Code>
      )}
    </Stack>
  );
}

export function ShaclValidation() {
  const { extensions } = useRdfMeta();
  const [model, setModel] = useState<File>();
  const [shacl, setShacl] = useState<File>();
  const [state, setState] = useState<{ valid: boolean; error?: string } | null>(null);
  const submit = async () => {
    if (!model || !shacl) return;
    setState(null);
    try {
      await toolboxApi.shaclValidation(model, shacl);
      setState({ valid: true });
    } catch (e) {
      setState({ valid: false, error: errorMessage(e) });
    }
    setModel(undefined);
    setShacl(undefined);
  };
  return (
    <Stack gap="sm">
      <FilePicker
        onFiles={(f) => setModel(f[0])}
        accept={acceptExtensions(extensions)}
        files={model ? [model] : []}
        label="Model to validate"
      />
      <FilePicker
        onFiles={(f) => setShacl(f[0])}
        accept={acceptExtensions(extensions)}
        files={shacl ? [shacl] : []}
        label="Shacl shapes"
      />
      <Group justify="flex-end">
        <Button disabled={!model || !shacl} onClick={submit}>
          Validate
        </Button>
      </Group>
      {state?.valid && (
        <Alert color="green" icon={<Icon icon="check" />}>
          VALID
        </Alert>
      )}
      {state && !state.valid && (
        <Alert color="red" icon={<Icon icon="exclamation-triangle" />} title="NOT VALID">
          <Code block className="pre-wrap">
            {state.error}
          </Code>
        </Alert>
      )}
    </Stack>
  );
}

export function RdfTools() {
  return (
    <Tabs defaultValue="file-conversion" variant="outline">
      <Tabs.List justify="center">
        <Tabs.Tab value="file-conversion">File</Tabs.Tab>
        <Tabs.Tab value="string-conversion">Text</Tabs.Tab>
        <Tabs.Tab value="shacl-validation">Shacl</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="file-conversion" p="md">
        <RdfFileToFile />
      </Tabs.Panel>
      <Tabs.Panel value="string-conversion" p="md">
        <RdfStringToLang />
      </Tabs.Panel>
      <Tabs.Panel value="shacl-validation" p="md">
        <ShaclValidation />
      </Tabs.Panel>
    </Tabs>
  );
}

type RdfaModule = {
  html_to_rdfa: (html: string, base: string, well: string) => string;
  rdfa_to_turtle: (s: string) => string;
};

/** html -> rdfa -> turtle, computed in the browser with the web-rdfa wasm module */
export function RdfaTool() {
  const [html, setHtml] = useState('');
  const [out, setOut] = useState('');
  const [mod, setMod] = useState<RdfaModule>();
  useEffect(() => {
    let cancelled = false;
    Promise.all([import('@nbittich/web-rdfa/rdfa_wasm'), import('@nbittich/web-rdfa/rdfa_wasm_bg.wasm?url')])
      .then(async ([m, wasm]) => {
        await m.default(wasm.default);
        if (!cancelled) setMod(m as unknown as RdfaModule);
      })
      .catch((e) => console.error('could not load rdfa wasm', e));
    return () => {
      cancelled = true;
    };
  }, []);
  const run = () => {
    if (!mod) return;
    try {
      setOut(mod.rdfa_to_turtle(mod.html_to_rdfa(html, '', '')));
    } catch (e) {
      toast.error(String(e));
    }
  };
  return (
    <Stack gap="sm">
      <Textarea
        label="Input Data"
        placeholder="Paste your HTML data here"
        minRows={10}
        autosize
        maxRows={20}
        value={html}
        onChange={(e) => setHtml(e.currentTarget.value)}
      />
      <Button fullWidth onClick={run} disabled={!mod}>
        Run
      </Button>
      {out && (
        <Code block className="pre-wrap">
          {out}
        </Code>
      )}
    </Stack>
  );
}

export function QrCodeTool() {
  const [data, setData] = useState('');
  const [url, setUrl] = useState<string>();
  const generate = async () => {
    if (!data) return;
    try {
      setUrl(await QRCode.toDataURL(data, { width: 300, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } }));
    } catch (e) {
      console.error('Error generating QR code:', e);
      setUrl(undefined);
    }
  };
  return (
    <Stack gap="sm">
      <Textarea
        label="Input Data"
        placeholder="Enter text or URL to generate QR code"
        minRows={8}
        autosize
        value={data}
        onChange={(e) => setData(e.currentTarget.value)}
      />
      <Button fullWidth onClick={generate}>
        Run
      </Button>
      {url && <Image src={url} alt="QR Code" w={300} mx="auto" />}
    </Stack>
  );
}

export function PasswordGenerator() {
  const [length, setLength] = useState<number | string>(16);
  const [opts, setOpts] = useState({ simpleSpecial: true, accented: true, complexSpecial: true, emoji: false });
  const [password, setPassword] = useState('');
  const toggle = (key: keyof typeof opts) => setOpts((o) => ({ ...o, [key]: !o[key] }));
  return (
    <Stack gap="sm">
      <NumberInput label="Length" min={4} max={64} value={length} onChange={setLength} />
      <Checkbox label="simpleSpecial" checked={opts.simpleSpecial} onChange={() => toggle('simpleSpecial')} />
      <Checkbox label="accentedLetters" checked={opts.accented} onChange={() => toggle('accented')} />
      <Checkbox label="complex" checked={opts.complexSpecial} onChange={() => toggle('complexSpecial')} />
      <Checkbox label="emojis" checked={opts.emoji} onChange={() => toggle('emoji')} />
      <Button fullWidth onClick={() => setPassword(generatePassword({ ...opts, length: Number(length) || 16 }))}>
        Generate
      </Button>
      {password && <CopyButton text={password} label={password} fullWidth variant="default" size="md" />}
    </Stack>
  );
}
