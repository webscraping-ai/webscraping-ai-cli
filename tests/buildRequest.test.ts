import { describe, expect, it } from 'vitest';

import {
  buildCommonOptions,
  buildDataOptions,
  buildFieldsOptions,
  buildHtmlOptions,
  buildQuestionOptions,
  buildSelectedMultipleOptions,
  buildSelectedOptions,
  buildSerpLocationsOptions,
  buildSerpOptions,
  buildTextOptions,
  parseDataParams,
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
    const result = buildSelectedMultipleOptions('https://example.com', ['h1', '.price'], {}, {});
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
    const result = buildQuestionOptions('https://example.com', 'In stock?', { format: 'json' }, {});
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

describe('buildSerpOptions', () => {
  it('sends only q when no flags are set, so API defaults apply', () => {
    expect(buildSerpOptions('coffee machines')).toEqual({ q: 'coffee machines' });
  });

  it('maps --engine, --gl, --hl and --page', () => {
    const result = buildSerpOptions('coffee machines', {
      engine: 'google',
      gl: 'de',
      hl: 'de',
      page: 2,
    });
    expect(result).toEqual({ q: 'coffee machines', engine: 'google', gl: 'de', hl: 'de', page: 2 });
  });

  it('never carries scrape options (url, js, proxy, country)', () => {
    const result = buildSerpOptions('coffee', {
      js: false,
      proxy: 'residential',
      country: 'gb',
    } as never);
    expect(Object.keys(result)).toEqual(['q']);
  });

  it('rejects an empty or whitespace-only query but sends others untrimmed', () => {
    expect(buildSerpOptions('  coffee  ').q).toBe('  coffee  ');
    expect(buildSerpOptions('#coffee').q).toBe('#coffee');
    expect(() => buildSerpOptions('')).toThrow(/non-empty query/);
    expect(() => buildSerpOptions('   ')).toThrow(/non-empty query/);
    expect(() => buildSerpOptions('\t\n')).toThrow(/non-empty query/);
  });

  it('rejects --page below 1 or non-integer', () => {
    expect(() => buildSerpOptions('coffee', { page: 0 })).toThrow(/--page/);
    expect(() => buildSerpOptions('coffee', { page: -3 })).toThrow(/--page/);
    expect(() => buildSerpOptions('coffee', { page: 1.5 })).toThrow(/--page/);
    expect(() => buildSerpOptions('coffee', { page: Number.NaN })).toThrow(/--page/);
  });

  it('maps --pages and the location flags, sending location and uule as given', () => {
    expect(
      buildSerpOptions('coffee machines', {
        pages: 2,
        location: ' Austin, TX ',
        radius: 500,
      }),
    ).toEqual({ q: 'coffee machines', pages: 2, location: ' Austin, TX ', radius: 500 });
    expect(buildSerpOptions('coffee', { uule: 'w+CAIQICI' })).toEqual({
      q: 'coffee',
      uule: 'w+CAIQICI',
    });
    expect(buildSerpOptions('coffee', { lat: -33.86, lon: 151.2093 })).toEqual({
      q: 'coffee',
      lat: -33.86,
      lon: 151.2093,
    });
  });

  it('leaves location exclusivity and ranges to the server', () => {
    expect(
      buildSerpOptions('coffee', { location: 'Austin, TX', lat: 95, lon: 200, pages: 9 }),
    ).toEqual({ q: 'coffee', location: 'Austin, TX', lat: 95, lon: 200, pages: 9 });
  });

  it('rejects --pages and --radius below 1 or non-integer', () => {
    for (const bad of [0, -1, 1.5, Number.NaN, 1e21]) {
      expect(() => buildSerpOptions('coffee', { pages: bad })).toThrow(/--pages/);
      expect(() => buildSerpOptions('coffee', { radius: bad })).toThrow(/--radius/);
    }
  });

  it('rejects a non-finite --lat or --lon', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      expect(() => buildSerpOptions('coffee', { lat: bad, lon: 1 })).toThrow(/--lat/);
      expect(() => buildSerpOptions('coffee', { lat: 1, lon: bad })).toThrow(/--lon/);
    }
  });
});

describe('buildSerpLocationsOptions', () => {
  it('sends q and limit when given', () => {
    expect(buildSerpLocationsOptions('austin', 3)).toEqual({ q: 'austin', limit: 3 });
    expect(buildSerpLocationsOptions('new york')).toEqual({ q: 'new york' });
  });

  it('omits a missing or blank query so the most populous locations come back', () => {
    expect(buildSerpLocationsOptions(undefined)).toEqual({});
    expect(buildSerpLocationsOptions('   ')).toEqual({});
  });

  it('rejects --limit below 1 or non-integer', () => {
    for (const bad of [0, -1, 2.5, Number.NaN]) {
      expect(() => buildSerpLocationsOptions('austin', bad)).toThrow(/--limit/);
    }
  });
});

describe('buildDataOptions', () => {
  it('sends only url when no flags are set, so API defaults apply', () => {
    expect(buildDataOptions('https://www.youtube.com/watch?v=x')).toEqual({
      url: 'https://www.youtube.com/watch?v=x',
    });
  });

  it('maps --country, --transcript, --transcript-language and --param', () => {
    expect(
      buildDataOptions('https://www.youtube.com/watch?v=x', {
        country: 'gb',
        transcript: true,
        transcriptLanguage: 'de',
        param: ['comments=20', 'q=a=b&c'],
      }),
    ).toEqual({
      url: 'https://www.youtube.com/watch?v=x',
      country: 'gb',
      transcript: true,
      transcript_language: 'de',
      params: { comments: '20', q: 'a=b&c' },
    });
  });

  it('passes an arbitrary unknown-site URL through unmodified', () => {
    for (const url of [
      'https://example.com/anything',
      '  https://Example.COM/A%2Fb/ünï?x=1&y=a b#Frag  ',
      'foo',
    ]) {
      expect(buildDataOptions(url)).toEqual({ url });
    }
  });

  it('never carries scrape options (js, proxy, headers)', () => {
    const result = buildDataOptions('https://example.com/', {
      js: false,
      proxy: 'residential',
      headers: { a: 'b' },
    } as never);
    expect(Object.keys(result)).toEqual(['url']);
  });

  it('rejects an empty or whitespace-only url', () => {
    expect(() => buildDataOptions('')).toThrow(/non-empty url/);
    expect(() => buildDataOptions('  \t')).toThrow(/non-empty url/);
  });
});

describe('parseDataParams', () => {
  it('splits on the first = and allows empty values', () => {
    expect(parseDataParams(['a=1', 'b=x=y', 'c='])).toEqual({ a: '1', b: 'x=y', c: '' });
  });

  it('rejects entries without a key or =', () => {
    expect(() => parseDataParams(['novalue'])).toThrow(/key=value/);
    expect(() => parseDataParams(['=x'])).toThrow(/key=value/);
  });

  it('rejects reserved keys: api_key, url, from_cli, __proto__', () => {
    for (const key of ['api_key', 'url', 'from_cli', '__proto__']) {
      expect(() => parseDataParams([`${key}=x`])).toThrow(new RegExp(`must not set "${key}"`));
    }
  });

  it('rejects keys that have their own flag and names the flag', () => {
    expect(() => parseDataParams(['country=de'])).toThrow(/"country"; use --country/);
    expect(() => parseDataParams(['transcript=true'])).toThrow(/use --transcript$/);
    expect(() => parseDataParams(['transcript_language=en'])).toThrow(/use --transcript-language/);
  });

  it('rejects a repeated key', () => {
    expect(() => parseDataParams(['a=1', 'a=2'])).toThrow(/"a" given more than once/);
  });

  it('allows keys that only look like Object.prototype members', () => {
    expect(parseDataParams(['constructor=x', 'toString=y'])).toEqual({
      constructor: 'x',
      toString: 'y',
    });
  });
});
