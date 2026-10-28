import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateEqualSplits,
  validateCustomSplits,
  calculateBalances,
  calculateMinimalSettlements,
  calculateNaiveTransferCount,
  calculatePairwiseTransferCount,
} from '../split-engine';

describe('SplitEngine Core Logic Tests', () => {
  it('1. Equal split with remainder distributes minor units deterministically', () => {
    // Expense: $100.00 (10000 cents) between 3 roommates (Alice, Bob, Charlie)
    const members = ['charles', 'alice', 'bob'];
    const splits = calculateEqualSplits(10000, members);

    assert.strictEqual(splits.length, 3);
    const sum = splits.reduce((acc, s) => acc + s.shareMinor, 0);
    assert.strictEqual(sum, 10000, 'Sum of shares must be exactly 10000 cents');

    // Deterministic sort: alice, bob, charles.
    // 10000 / 3 = 3333 with remainder 1.
    // Alice gets 3334, Bob gets 3333, Charles gets 3333.
    const aliceShare = splits.find((s) => s.memberId === 'alice')?.shareMinor;
    const bobShare = splits.find((s) => s.memberId === 'bob')?.shareMinor;
    const charlesShare = splits.find((s) => s.memberId === 'charles')?.shareMinor;

    assert.strictEqual(aliceShare, 3334);
    assert.strictEqual(bobShare, 3333);
    assert.strictEqual(charlesShare, 3333);
  });

  it('2. Custom split validation passes when shares equal total, rejects mismatch', () => {
    // Total $100.00 (10000 cents)
    const validSplits = [
      { memberId: 'alice', shareMinor: 6000 },
      { memberId: 'bob', shareMinor: 4000 },
    ];
    const validResult = validateCustomSplits(10000, validSplits);
    assert.strictEqual(validResult.valid, true);

    const invalidSplits = [
      { memberId: 'alice', shareMinor: 6000 },
      { memberId: 'bob', shareMinor: 3000 },
    ];
    const invalidResult = validateCustomSplits(10000, invalidSplits);
    assert.strictEqual(invalidResult.valid, false);
    assert.ok(invalidResult.error?.includes('must match total amount'));
  });

  it('3. Already-settled group produces an empty minimal settle-up plan', () => {
    const balances = new Map<string, { netBalanceMinor: number; memberId: string; totalPaidMinor: number; totalOwedMinor: number; settledOutMinor: number; settledInMinor: number }>();
    balances.set('alice', {
      memberId: 'alice',
      totalPaidMinor: 5000,
      totalOwedMinor: 5000,
      settledOutMinor: 0,
      settledInMinor: 0,
      netBalanceMinor: 0,
    });
    balances.set('bob', {
      memberId: 'bob',
      totalPaidMinor: 5000,
      totalOwedMinor: 5000,
      settledOutMinor: 0,
      settledInMinor: 0,
      netBalanceMinor: 0,
    });

    const plan = calculateMinimalSettlements(balances);
    assert.strictEqual(plan.length, 0, 'No payments needed when already settled');
  });

  it('4. 4-person debt chain reduces to minimal direct payment', () => {
    // A paid $100 for B
    // B paid $100 for C
    // C paid $100 for D
    // Net:
    // A: +100
    // B: +100 - 100 = 0
    // C: +100 - 100 = 0
    // D: -100
    // Settle-up should be single direct payment: D pays A $100
    const memberIds = ['A', 'B', 'C', 'D'];
    const expenses = [
      { paidByMemberId: 'A', amountMinor: 10000 },
      { paidByMemberId: 'B', amountMinor: 10000 },
      { paidByMemberId: 'C', amountMinor: 10000 },
    ];
    const splits = [
      { memberId: 'B', shareMinor: 10000 },
      { memberId: 'C', shareMinor: 10000 },
      { memberId: 'D', shareMinor: 10000 },
    ];

    const balances = calculateBalances({
      memberIds,
      expenses,
      splits,
      settlements: [],
    });

    assert.strictEqual(balances.get('A')?.netBalanceMinor, 10000);
    assert.strictEqual(balances.get('B')?.netBalanceMinor, 0);
    assert.strictEqual(balances.get('C')?.netBalanceMinor, 0);
    assert.strictEqual(balances.get('D')?.netBalanceMinor, -10000);

    const plan = calculateMinimalSettlements(balances);
    assert.strictEqual(plan.length, 1, 'Should resolve in exactly 1 payment instead of 3');
    assert.strictEqual(plan[0].fromMemberId, 'D');
    assert.strictEqual(plan[0].toMemberId, 'A');
    assert.strictEqual(plan[0].amountMinor, 10000);
  });

  it('5. Settlement records update balances to settled state', () => {
    // Alice paid $60 for Alice & Bob ($30 each). Bob owes Alice $30.
    const memberIds = ['alice', 'bob'];
    const expenses = [{ paidByMemberId: 'alice', amountMinor: 6000 }];
    const splits = [
      { memberId: 'alice', shareMinor: 3000 },
      { memberId: 'bob', shareMinor: 3000 },
    ];

    // Initial check
    const preBalances = calculateBalances({
      memberIds,
      expenses,
      splits,
      settlements: [],
    });
    assert.strictEqual(preBalances.get('alice')?.netBalanceMinor, 3000);
    assert.strictEqual(preBalances.get('bob')?.netBalanceMinor, -3000);

    // Bob records a settlement of $30 to Alice
    const settlements = [
      { fromMemberId: 'bob', toMemberId: 'alice', amountMinor: 3000 },
    ];

    const postBalances = calculateBalances({
      memberIds,
      expenses,
      splits,
      settlements,
    });
    assert.strictEqual(postBalances.get('alice')?.netBalanceMinor, 0);
    assert.strictEqual(postBalances.get('bob')?.netBalanceMinor, 0);

    const plan = calculateMinimalSettlements(postBalances);
    assert.strictEqual(plan.length, 0);
  });

  it('6. Settle-up visualization: Naive vs Minimal transfer count comparisons', () => {
    // 4 Roommates: A, B, C, D
    // A paid $30 for B (B owes A $30)
    // B paid $30 for C (C owes B $30)
    // C paid $30 for D (D owes C $30)
    const splits = [
      { memberId: 'B', shareMinor: 3000, payerMemberId: 'A' },
      { memberId: 'C', shareMinor: 3000, payerMemberId: 'B' },
      { memberId: 'D', shareMinor: 3000, payerMemberId: 'C' },
    ];

    const naiveCount = calculateNaiveTransferCount(splits);
    assert.strictEqual(naiveCount, 3, 'Naive count requires 3 separate repayments');

    const balances = new Map<string, any>();
    balances.set('A', { netBalanceMinor: 3000 });
    balances.set('B', { netBalanceMinor: 0 });
    balances.set('C', { netBalanceMinor: 0 });
    balances.set('D', { netBalanceMinor: -3000 });

    const minimalPlan = calculateMinimalSettlements(balances);
    assert.strictEqual(minimalPlan.length, 1, 'SplitNest greedy algorithm simplifies 3 naive transfers to 1 direct payment');
    assert.strictEqual(minimalPlan[0].fromMemberId, 'D');
    assert.strictEqual(minimalPlan[0].toMemberId, 'A');
    assert.strictEqual(minimalPlan[0].amountMinor, 3000);
  });

  it('7. Already settled group has 0 naive and 0 minimal transfers', () => {
    const splits: any[] = [];
    const naiveCount = calculateNaiveTransferCount(splits);
    assert.strictEqual(naiveCount, 0);

    const balances = new Map<string, any>();
    balances.set('A', { netBalanceMinor: 0 });
    balances.set('B', { netBalanceMinor: 0 });

    const minimalPlan = calculateMinimalSettlements(balances);
    assert.strictEqual(minimalPlan.length, 0);
  });
});
