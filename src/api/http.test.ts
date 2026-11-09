import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { errorMessage, filenameFromDisposition } from './http';

describe('filenameFromDisposition', () => {
  it('reads quoted and unquoted filenames', () => {
    expect(filenameFromDisposition('attachment; filename="invoice 01.pdf"')).toBe('invoice 01.pdf');
    expect(filenameFromDisposition('attachment; filename=dossier.zip')).toBe('dossier.zip');
  });

  it('prefers the utf-8 filename', () => {
    expect(filenameFromDisposition(`attachment; filename="a.pdf"; filename*=UTF-8''fa%C3%A7ture.pdf`)).toBe('façture.pdf');
  });

  it('falls back when there is no header', () => {
    expect(filenameFromDisposition(undefined)).toBe('download');
    expect(filenameFromDisposition(null, 'x.bin')).toBe('x.bin');
  });
});

describe('errorMessage', () => {
  const axiosError = (data: unknown) => {
    const err = new AxiosError('Request failed');
    err.response = { data, status: 400, statusText: 'Bad Request', headers: {}, config: { headers: new AxiosHeaders() } };
    return err;
  };

  it('uses the text body of the response', () => {
    expect(errorMessage(axiosError('shacl: not valid'))).toBe('shacl: not valid');
  });

  it('uses the message of a json body', () => {
    expect(errorMessage(axiosError({ message: 'boom' }))).toBe('boom');
  });

  it('handles plain errors', () => {
    expect(errorMessage(new Error('oops'))).toBe('oops');
    expect(errorMessage('raw')).toBe('raw');
  });
});
