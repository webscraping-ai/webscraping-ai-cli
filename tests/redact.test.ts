import { afterEach, describe, expect, it } from 'vitest';

import { APIError } from 'webscraping-ai';

import { formatError } from '../src/lib/errors.js';
import { clearSecrets, redactSecrets, registerSecret } from '../src/lib/redact.js';

afterEach(() => clearSecrets());

describe('redactSecrets', () => {
  it('redacts any api_key=... query parameter', () => {
    expect(redactSecrets('GET /html?url=x&api_key=abc123&js=false')).toBe(
      'GET /html?url=x&api_key=[REDACTED]&js=false',
    );
  });

  it('redacts a registered key wherever it appears, raw or URL-encoded', () => {
    registerSecret('k3y/with+chars');
    expect(redactSecrets('key k3y/with+chars and k3y%2Fwith%2Bchars')).toBe(
      'key [REDACTED] and [REDACTED]',
    );
  });
});

describe('formatError', () => {
  it('never prints the API key from an HTML error body that echoes the URL', () => {
    registerSecret('secret-key-123');
    const body =
      '<html><body>Bad gateway for https://api.webscraping.ai/html?url=a&api_key=secret-key-123</body></html>';
    const err = new APIError({ message: body, status: 502 });
    const text = formatError(err);
    expect(text).not.toContain('secret-key-123');
    expect(text).toContain('api_key=[REDACTED]');
    expect(text).toContain('(HTTP 502)');
  });

  it('redacts plain errors too', () => {
    registerSecret('secret-key-123');
    expect(formatError(new Error('failed with secret-key-123'))).toBe('failed with [REDACTED]');
  });
});
