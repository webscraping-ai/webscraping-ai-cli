import { describe, expect, it } from 'vitest';

import {
  buildCommonOptions,
  buildFieldsOptions,
  buildHtmlOptions,
  buildQuestionOptions,
  buildSelectedMultipleOptions,
  buildSelectedOptions,
  buildTextOptions,
} from '../src/lib/buildRequest.js';

const FLAGS_EMPTY = {};

describe('buildCommonOptions', () => {
  it('drops undefined flags so API defaults apply', () => {
    expect(buildCommonOptions(FLAGS_EMPTY)).toEqual({});
  });

  it('passes --js / --no-js through as a boolean', () => {
    expect(buildCommonOptions({ js: true }).js).toBe(true);
    expect(buildCommonOptions({ js: false }).js).toBe(false);
  });

  it('maps kebab CLI flags to snake_case SDK fields', () => {
    const result = buildCommonOptions({
      jsTimeout: 5000,
      waitFor: '.product',
      jsScript: 'window.scrollTo(0, 1000)',
      customProxy: 'http://user:pass@proxy.example.com:8080',
      errorOn404: true,
      errorOnRedirect: true,
    });
    expect(result).toEqual({
      js_timeout: 5000,
      wait_for: '.product',
      js_script: 'window.scrollTo(0, 1000)',
      custom_proxy: 'http://user:pass@proxy.example.com:8080',
      error_on_404: true,
      error_on_redirect: true,
    });
  });

  it('forwards proxy / country / device / timeout', () => {
    const result = buildCommonOptions({
      proxy: 'residential',
      country: 'de',
      device: 'mobile',
      timeout: 15000,
    });
    expect(result).toEqual({
      proxy: 'residential',
      country: 'de',
      device: 'mobile',
      timeout: 15000,
    });
  });

  it('attaches resolved headers when present', () => {
    const result = buildCommonOptions({}, { headers: { Cookie: 'session=abc' } });
    expect(result.headers).toEqual({ Cookie: 'session=abc' });
  });
});

describe('buildHtmlOptions', () => {
  it('includes the URL and forwards --format / --return-script-result', () => {
    const result = buildHtmlOptions(
      'https://example.com',
      { format: 'json' },
      {},
      { returnScriptResult: true },
    );
    expect(result).toEqual({
      url: 'https://example.com',
      format: 'json',
      return_script_result: true,
    });
  });
});

describe('buildTextOptions', () => {
  it('forwards --text-format and --return-links', () => {
    const result = buildTextOptions(
      'https://example.com',
      {},
      {},
      { textFormat: 'json', returnLinks: true },
    );
    expect(result).toEqual({
      url: 'https://example.com',
      text_format: 'json',
      return_links: true,
    });
  });
});

describe('buildSelectedOptions', () => {
  it('attaches selector and optional --format', () => {
    const result = buildSelectedOptions('https://example.com', 'h1', { format: 'text' }, {});
    expect(result).toEqual({ url: 'https://example.com', selector: 'h1', format: 'text' });
  });

  it('omits selector when none given (whole-page HTML)', () => {
    const result = buildSelectedOptions('https://example.com', undefined, {}, {});
    expect(result).toEqual({ url: 'https://example.com' });
    expect(result).not.toHaveProperty('selector');
  });
});

describe('buildSelectedMultipleOptions', () => {
  it('attaches selectors array', () => {
    const result = buildSelectedMultipleOptions(
      'https://example.com',
      ['h1', '.price'],
      {},
      {},
    );
    expect(result).toEqual({ url: 'https://example.com', selectors: ['h1', '.price'] });
  });

  it('omits selectors when none given (whole-page HTML)', () => {
    const result = buildSelectedMultipleOptions('https://example.com', [], {}, {});
    expect(result).toEqual({ url: 'https://example.com' });
    expect(result).not.toHaveProperty('selectors');
  });
});

describe('buildQuestionOptions', () => {
  it('attaches question and optional --format', () => {
    const result = buildQuestionOptions(
      'https://example.com',
      'In stock?',
      { format: 'json' },
      {},
    );
    expect(result).toEqual({
      url: 'https://example.com',
      question: 'In stock?',
      format: 'json',
    });
  });
});

describe('buildFieldsOptions', () => {
  it('attaches the fields object', () => {
    const fields = { title: 'Product title', price: 'Current price' };
    const result = buildFieldsOptions('https://example.com', fields, {}, {});
    expect(result).toEqual({ url: 'https://example.com', fields });
  });
});
