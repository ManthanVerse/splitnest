import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateCategorySpending,
  calculateMemberSpending,
  calculateTimelineSpending,
  calculateSpendingSummary,
} from '../spending-insights';
import { generateExpensesCSV } from '../csv-export';
import { buildExpenseQueries } from '../query-builder';

describe('Phase 3 Feature Engines Tests', () => {
  it('1. Category spending aggregation calculates totals and percentages accurately', () => {
    const expenses = [
      { category: 'groceries', amountMinor: 5000 },
      { category: 'groceries', amountMinor: 5000 },
      { category: 'utilities', amountMinor: 10000 },
    ];

    const result = calculateCategorySpending(expenses);
    assert.strictEqual(result.length, 2);
    // Utilities ($100 = 50%), Groceries ($100 = 50%)
    assert.strictEqual(result[0].category, 'groceries');
    assert.strictEqual(result[0].amountMinor, 10000);
    assert.strictEqual(result[0].percentage, 50);

    assert.strictEqual(result[1].category, 'utilities');
    assert.strictEqual(result[1].amountMinor, 10000);
    assert.strictEqual(result[1].percentage, 50);
  });

  it('2. Member spending computes total paid vs total consumed shares', () => {
    const members = [
      { id: 'm1', displayName: 'Alice' },
      { id: 'm2', displayName: 'Bob' },
    ];
    const expenses = [{ paidByMemberId: 'm1', amountMinor: 10000 }];
    const splits = [
      { memberId: 'm1', shareMinor: 5000 },
      { memberId: 'm2', shareMinor: 5000 },
    ];

    const result = calculateMemberSpending(members, expenses, splits);
    assert.strictEqual(result.length, 2);

    const alice = result.find((m) => m.memberId === 'm1');
    assert.strictEqual(alice?.totalPaidMinor, 10000);
    assert.strictEqual(alice?.totalShareMinor, 5000);
    assert.strictEqual(alice?.netMinor, 5000);

    const bob = result.find((m) => m.memberId === 'm2');
    assert.strictEqual(bob?.totalPaidMinor, 0);
    assert.strictEqual(bob?.totalShareMinor, 5000);
    assert.strictEqual(bob?.netMinor, -5000);
  });

  it('3. CSV export outputs RFC 4180 compliant formatted data with per-member shares', () => {
    const members: any[] = [
      { $id: 'm1', displayName: 'Alice' },
      { $id: 'm2', displayName: 'Bob' },
    ];
    const expenses: any[] = [
      {
        $id: 'e1',
        description: 'Groceries, fruit & snacks',
        amountMinor: 6000,
        category: 'groceries',
        expenseDate: '2026-10-15T12:00:00Z',
        paidBy: { displayName: 'Alice' },
        splitType: 'equal',
        splits: [
          { member: { $id: 'm1' }, shareMinor: 3000 },
          { member: { $id: 'm2' }, shareMinor: 3000 },
        ],
      },
    ];

    const csv = generateExpensesCSV({ expenses, members, currency: 'USD' });
    const lines = csv.split('\r\n');

    assert.strictEqual(lines.length, 2);
    assert.ok(lines[0].includes('"Date","Description","Category","Paid By","Total Amount (USD)"'));
    assert.ok(lines[0].includes('"Share: Alice (USD)"'));
    assert.ok(lines[0].includes('"Share: Bob (USD)"'));

    // Check row data
    assert.ok(lines[1].includes('"2026-10-15"'));
    assert.ok(lines[1].includes('"Groceries, fruit & snacks"'));
    assert.ok(lines[1].includes('"60.00"'));
    assert.ok(lines[1].includes('"30.00"'));
  });

  it('4. Query builder generates exact Appwrite TablesDB operators', () => {
    const queries = buildExpenseQueries({
      groupId: 'g_123',
      category: 'groceries',
      paidByMemberId: 'm_1',
      search: 'costco',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      minAmountMinor: 1000,
      maxAmountMinor: 5000,
      sortBy: 'highest',
      limit: 10,
      offset: 0,
    });

    const parsed = queries.map((q) => JSON.parse(q));

    assert.ok(parsed.some((q) => q.method === 'equal' && q.attribute === 'group'));
    assert.ok(parsed.some((q) => q.method === 'equal' && q.attribute === 'category'));
    assert.ok(parsed.some((q) => q.method === 'equal' && q.attribute === 'paidBy'));
    assert.ok(parsed.some((q) => q.method === 'search' && q.attribute === 'description'));
    assert.ok(parsed.some((q) => q.method === 'greaterThanEqual' && q.attribute === 'expenseDate'));
    assert.ok(parsed.some((q) => q.method === 'lessThanEqual' && q.attribute === 'expenseDate'));
    assert.ok(parsed.some((q) => q.method === 'greaterThanEqual' && q.attribute === 'amountMinor'));
    assert.ok(parsed.some((q) => q.method === 'lessThanEqual' && q.attribute === 'amountMinor'));
    assert.ok(parsed.some((q) => q.method === 'orderDesc' && q.attribute === 'amountMinor'));
    assert.ok(parsed.some((q) => q.method === 'select'));
  });
});
