import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Waterfall } from '../src/components/charts/Graphs';

describe('budget waterfall', () => {
  it('shows an over-budget remainder as negative with valid chart geometry', () => {
    const html = renderToStaticMarkup(createElement(Waterfall, {
      total: 10_000, totalLabel: 'Budget', endLabel: 'Left',
      steps: [{ label: 'Paid', value: 12_000, tone: 'red' }], format: String,
    }));
    expect(html).toContain('−2000');
    expect(html).not.toMatch(/NaN|Infinity/);
    const sizes = [...html.matchAll(/(?:bottom|height):(-?\d+(?:\.\d+)?)%/g)].map((match) => Number(match[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
  });
});
