import { describe, expect, it } from 'vitest';
import { buildPropagationOps } from './co-propagation';

describe('buildPropagationOps', () => {
  it('produces flip + sub increment + per-line increments in order', () => {
    const ops = buildPropagationOps({
      changeOrderId: 'co_1',
      totalAmount: '34700.00',
      affectedSubcontractId: 'sub_1',
      lines: [
        { sovLineId: 'line_3a', deltaAmount: '8400.00' },
        { sovLineId: 'line_3b', deltaAmount: '24200.00' },
        { sovLineId: 'line_3c', deltaAmount: '2100.00' },
      ],
    });
    expect(ops).toEqual([
      { kind: 'updateChangeOrderApproved', changeOrderId: 'co_1' },
      {
        kind: 'incrementSubcontract',
        subcontractId: 'sub_1',
        deltaAmount: '34700.00',
      },
      {
        kind: 'incrementSovLine',
        sovLineId: 'line_3a',
        deltaAmount: '8400.00',
      },
      {
        kind: 'incrementSovLine',
        sovLineId: 'line_3b',
        deltaAmount: '24200.00',
      },
      {
        kind: 'incrementSovLine',
        sovLineId: 'line_3c',
        deltaAmount: '2100.00',
      },
    ]);
  });

  it('skips subcontract increment when affectedSubcontractId is null', () => {
    const ops = buildPropagationOps({
      changeOrderId: 'co_2',
      totalAmount: '500.00',
      affectedSubcontractId: null,
      lines: [{ sovLineId: 'line_x', deltaAmount: '500.00' }],
    });
    expect(ops).toHaveLength(2);
    expect(ops[0]).toEqual({
      kind: 'updateChangeOrderApproved',
      changeOrderId: 'co_2',
    });
    expect(ops[1]).toEqual({
      kind: 'incrementSovLine',
      sovLineId: 'line_x',
      deltaAmount: '500.00',
    });
  });

  it('handles negative deltas (deduct COs)', () => {
    const ops = buildPropagationOps({
      changeOrderId: 'co_3',
      totalAmount: '-1000.00',
      affectedSubcontractId: 'sub_2',
      lines: [{ sovLineId: 'line_y', deltaAmount: '-1000.00' }],
    });
    expect(ops[1]).toEqual({
      kind: 'incrementSubcontract',
      subcontractId: 'sub_2',
      deltaAmount: '-1000.00',
    });
  });

  it('throws when there are no line items', () => {
    expect(() =>
      buildPropagationOps({
        changeOrderId: 'co_4',
        totalAmount: '0.00',
        affectedSubcontractId: 'sub_3',
        lines: [],
      }),
    ).toThrow(/no line items/);
  });
});
