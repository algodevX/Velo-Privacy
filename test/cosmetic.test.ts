import { describe, expect, it } from 'vitest';
import { CosmeticIndex, partitionGeneric } from '../src/shared/adblock/cosmetic-index';
import { isHideElementsRequest } from '../src/shared/adblock/protocol';
import { compileFilterList } from '../src/shared/filters/compile';

describe('partitionGeneric', () => {
  it('keys selectors by the class or id an element must carry', () => {
    expect(
      partitionGeneric([
        '.ad',
        '#banner',
        'div.sponsored > img',
        '.promo:not(.keep)',
        '#top [data-ad]',
        'a[href^="https://ads.example/"]',
        'AD-SLOT',
        '#\\5f cookie',
        '.a, .b',
      ]),
    ).toEqual({
      simple: ['.ad', '#banner'],
      keyed: {
        '.sponsored': ['div.sponsored > img'],
        '.promo': ['.promo:not(.keep)'],
        '#top': ['#top [data-ad]'],
      },
      unkeyed: ['a[href^="https://ads.example/"]', 'AD-SLOT', '#\\5f cookie', '.a, .b'],
    });
  });
});

describe('CosmeticIndex', () => {
  const index = new CosmeticIndex().addCompiled(
    compileFilterList([
      '##.ad',
      '##div.sponsored > img',
      '##a[href^="https://ads.example/"]',
      'news.example##.sidebar',
      'news.example#@#.ad',
      '@@||shop.example^$generichide',
    ]).cosmetic,
  );

  it('hides generic selectors only for keys seen in the page', () => {
    expect(index.genericFor('blog.example', ['.ad', '.unrelated'])).toEqual(['.ad']);
    expect(index.genericFor('blog.example', ['.sponsored'])).toEqual(['div.sponsored > img']);
    expect(index.genericFor('blog.example', ['.unrelated'])).toEqual([]);
  });

  it('starts pages with site-specific and unkeyed selectors', () => {
    expect(index.initialFor('www.news.example')).toEqual({
      selectors: ['.sidebar', 'a[href^="https://ads.example/"]'],
      surveyGeneric: true,
    });
  });

  it('applies exceptions and $generichide per site', () => {
    expect(index.genericFor('www.news.example', ['.ad'])).toEqual([]);
    expect(index.initialFor('shop.example')).toEqual({ selectors: [], surveyGeneric: false });
    expect(index.genericFor('shop.example', ['.ad'])).toEqual([]);
  });
});

describe('isHideElementsRequest', () => {
  it('accepts only well-formed, bounded requests', () => {
    expect(isHideElementsRequest({ type: 'hide-elements', keys: ['.ad'], first: false })).toBe(
      true,
    );
    expect(isHideElementsRequest({ type: 'hide-elements', keys: [1], first: false })).toBe(false);
    expect(isHideElementsRequest({ type: 'forget-site', site: 'a.example' })).toBe(false);
    const tooMany = Array.from({ length: 2_001 }, (_, i) => `.k${i}`);
    expect(isHideElementsRequest({ type: 'hide-elements', keys: tooMany, first: false })).toBe(
      false,
    );
  });
});
