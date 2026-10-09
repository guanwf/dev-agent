/**
 * @file Unit tests for surgical file patcher and fuzzy matching algorithm
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FilePatchTool, levenshteinDistance, stringSimilarity } from '../src/tools/file-patch.js';

describe('Surgical File Patcher', () => {
  let patcher: FilePatchTool;

  beforeEach(() => {
    patcher = new FilePatchTool();
  });

  describe('Levenshtein Algorithm', () => {
    it('calculates correct edit distance', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('same', 'same')).toBe(0);
      expect(levenshteinDistance('', 'test')).toBe(4);
    });

    it('calculates similarity ratio between 0 and 1', () => {
      expect(stringSimilarity('hello world', 'hello world')).toBe(1.0);
      expect(stringSimilarity('hello world', 'hello word')).toBeGreaterThan(0.9);
      expect(stringSimilarity('abc', 'xyz')).toBe(0);
    });
  });

  describe('Matching Capabilities', () => {
    const sampleCode = [
      'function computeTax(amount: number): number {',
      '  // calculate standard 8% tax',
      '  const rate = 0.08;',
      '  return amount * rate;',
      '}',
      '',
      'function formatPrice(price: number): string {',
      '  return "$" + price.toFixed(2);',
      '}'
    ].join('\n');

    it('finds exact matching blocks', () => {
      const search = [
        '  // calculate standard 8% tax',
        '  const rate = 0.08;',
        '  return amount * rate;'
      ].join('\n');

      const match = patcher.findMatch(sampleCode, search);
      expect(match).not.toBeNull();
      expect(match?.matchType).toBe('exact');
      expect(match?.startLine).toBe(1);
      expect(match?.endLine).toBe(4);
    });

    it('tolerates indentation whitespace variations (whitespace-normalized)', () => {
      // Different indentation (4 spaces instead of 2 spaces)
      const searchWithTabs = [
        '    // calculate standard 8% tax',
        '    const rate = 0.08;',
        '    return amount * rate;'
      ].join('\n');

      const match = patcher.findMatch(sampleCode, searchWithTabs);
      expect(match).not.toBeNull();
      expect(match?.matchType).toBe('whitespace-normalized');
    });

    it('finds fuzzy match when model has minor typos or altered comment', () => {
      // Slightly altered comment from model
      const searchFuzzy = [
        '  // calculate standard 8% taxes here',
        '  const rate = 0.08;',
        '  return amount * rate;'
      ].join('\n');

      const match = patcher.findMatch(sampleCode, searchFuzzy, 0.80);
      expect(match).not.toBeNull();
      expect(match?.matchType).toBe('fuzzy-levenshtein');
      expect(match?.similarity).toBeGreaterThanOrEqual(0.85);
    });

    it('applies surgical patch and replaces only targeted lines', () => {
      const search = [
        '  // calculate standard 8% tax',
        '  const rate = 0.08;',
        '  return amount * rate;'
      ].join('\n');

      const replace = [
        '  // updated tax calculation for 2026',
        '  const rate = 0.10;',
        '  return Math.round(amount * rate * 100) / 100;'
      ].join('\n');

      const { patchedContent, match } = patcher.applyPatch(
        sampleCode,
        'tax.ts',
        search,
        replace
      );

      expect(match.matchType).toBe('exact');
      expect(patchedContent).toContain('const rate = 0.10;');
      expect(patchedContent).toContain('function formatPrice(price: number): string {');
    });

    it('throws error on ambiguous duplicate search blocks without enough context', () => {
      const ambiguousCode = [
        'const x = 1;',
        'console.log("ok");',
        'const y = 2;',
        'console.log("ok");'
      ].join('\n');

      expect(() => {
        patcher.findMatch(ambiguousCode, 'console.log("ok");');
      }).toThrow(/Ambiguous match/);
    });
  });
});
