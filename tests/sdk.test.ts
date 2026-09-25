import { afterEach, describe, expect, it, vi } from 'vitest';

import { BadRequestError } from 'webscraping-ai';

import { formatError } from '../src/lib/errors.js';
import { clearSecrets } from '../src/lib/redact.js';
import { createClient } from '../src/lib/sdk.js';

const KEY = 'SECRET-cli-key-123';

function stubFetch(body: unknown, status = 200): URL[] {
  const urls: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      urls.push(new URL(String(input)));
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearSecrets();
});

describe('createClient analytics tag (real SDK, stubbed fetch)', () => {
  it('data: from_cli=true reaches the wire alongside the user params', async () => {
    const urls = stubFetch({ request_parameters: {}, parse_status: 'ok', data: null });
    const client = createClient({ apiKey: KEY });
    await client.data({
      url: 'https://www.youtube.com/watch?v=x',
      transcript: true,
      params: { comments: '20' },
    });

    expect(urls[0]!.pathname).toBe('/data');
    expect(Object.fromEntries(urls[0]!.searchParams)).toEqual({
      api_key: KEY,
      url: 'https://www.youtube.com/watch?v=x',
      transcript: 'true',
      comments: '20',
      from_cli: 'true',
    });
  });

  it('data: from_cli is sent when no params are given', async () => {
    const urls = stubFetch({});
    await createClient({ apiKey: KEY }).data({ url: 'https://example.com/anything' });

    expect(urls[0]!.searchParams.get('url')).toBe('https://example.com/anything');
    expect(urls[0]!.searchParams.get('from_cli')).toBe('true');
  });

  it('data: a server 400 maps to BadRequestError and the key is redacted from output', async () => {
    // The body echoes the key both raw and as api_key=..., so this fails without redaction.
    stubFetch(
      {
        message: `Unsupported URL for /data (GET /data?api_key=${KEY}&url=x, key ${KEY})`,
      },
      400,
    );
    const err = await createClient({ apiKey: KEY })
      .data({ url: 'https://example.com/' })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BadRequestError);
    expect((err as Error).message).toContain(KEY); // raw SDK error still has it...
    expect(formatError(err)).toBe(
      'Unsupported URL for /data (GET /data?api_key=[REDACTED]&url=x, key [REDACTED]) (HTTP 400)',
    );
    expect(formatError(err)).not.toContain(KEY); // ...but the CLI never prints it
  });

  it('data: a hostile URL reaches the wire byte-for-byte', async () => {
    const hostile = '  https://Example.COM/A%2Fb/ünï?x=1&y=a b#Frag  ';
    const raw: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        raw.push(String(input));
        return new Response('{}', { headers: { 'content-type': 'application/json' } });
      }),
    );
    await createClient({ apiKey: KEY }).data({ url: hostile });

    const query = raw[0]!.split('?')[1]!;
    expect(query.split('&')).toContain(`url=${encodeURIComponent(hostile)}`);
    expect(new URLSearchParams(query).get('url')).toBe(hostile);
  });

  it('serp: from_cli=true reaches the wire (via the SDK params pass-through)', async () => {
    const urls = stubFetch({ organic_results: [] });
    await createClient({ apiKey: KEY }).serp({ q: 'coffee', gl: 'de' });

    expect(urls[0]!.pathname).toBe('/serp');
    expect(Object.fromEntries(urls[0]!.searchParams)).toEqual({
      api_key: KEY,
      q: 'coffee',
      gl: 'de',
      from_cli: 'true',
    });
  });
});
