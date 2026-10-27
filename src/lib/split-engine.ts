/**
 * SplitNest Core Calculation Engine
 * 
 * Rules:
 * 1. Money is ALWAYS stored and computed as integer minor units (e.g. cents/paise) to prevent floating-point drift.
 * 2. Equal splits distribute remainder minor units deterministically so sum of shares === total expense.
 * 3. Balances are computed purely from rows (paid - owed + settlements).
 * 4. Minimal settle-up uses a greedy debtor-creditor matching algorithm to minimize payment transactions.
 */

export interface MemberBalance {
  memberId: string;
  totalPaidMinor: number;
  totalOwedMinor: number;
  settledOutMinor: number; // money this member paid in settlements to others
  settledInMinor: number;  // money this member received in settlements from others
  netBalanceMinor: number; // positive = is owed money; negative = owes money; 0 = settled
}

export interface SettlementPayment {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}

/**
 * Calculates equal shares for a total amount among participants,
 * deterministically distributing any remainder cents/minor units.
 */
export function calculateEqualSplits(
  totalAmountMinor: number,
  participantMemberIds: string[]
): { memberId: string; shareMinor: number }[] {
  if (totalAmountMinor <= 0) {
    throw new Error('Expense amount must be greater than zero');
  }
  if (!participantMemberIds || participantMemberIds.length === 0) {
    throw new Error('At least one participant is required for equal split');
  }

  // Sort participant IDs to ensure deterministic distribution of remainder
  const sortedIds = [...participantMemberIds].sort();
  const count = sortedIds.length;
  const baseShare = Math.floor(totalAmountMinor / count);
  const remainder = totalAmountMinor % count;

  return sortedIds.map((memberId, index) => ({
    memberId,
    shareMinor: index < remainder ? baseShare + 1 : baseShare,
  }));
}

/**
 * Validates custom splits and ensures they sum EXACTLY to the total expense amount.
 */
export function validateCustomSplits(
  totalAmountMinor: number,
  splits: { memberId: string; shareMinor: number }[]
): { valid: boolean; error?: string } {
  if (totalAmountMinor <= 0) {
    return { valid: false, error: 'Total expense amount must be greater than zero' };
  }
  if (!splits || splits.length === 0) {
    return { valid: false, error: 'At least one split is required' };
  }

  let sum = 0;
  for (const split of splits) {
    if (split.shareMinor < 0) {
      return { valid: false, error: 'Share amounts cannot be negative' };
    }
    sum += split.shareMinor;
  }

  if (sum !== totalAmountMinor) {
    return {
      valid: false,
      error: `Sum of shares (${sum}) must match total amount (${totalAmountMinor})`,
    };
  }

  return { valid: true };
}

/**
 * Computes net balances for all members in a group.
 * 
 * Formula for each member:
 * netBalance = totalPaid - totalOwed + settledOut - settledIn
 * 
 * Explanation:
 * - totalPaid: member paid this amount for group expenses (increases what they are owed)
 * - totalOwed: member's assigned share across all expenses (decreases their balance)
 * - settledOut: member made a direct debt settlement payment to someone (clears what they owed, increases net balance)
 * - settledIn: member received a direct debt settlement payment from someone (clears what they were owed, decreases net balance)
 */
export function calculateBalances(params: {
  memberIds: string[];
  expenses: { paidByMemberId: string; amountMinor: number }[];
  splits: { memberId: string; shareMinor: number }[];
  settlements: { fromMemberId: string; toMemberId: string; amountMinor: number }[];
}): Map<string, MemberBalance> {
  const balances = new Map<string, MemberBalance>();

  for (const id of params.memberIds) {
    balances.set(id, {
      memberId: id,
      totalPaidMinor: 0,
      totalOwedMinor: 0,
      settledOutMinor: 0,
      settledInMinor: 0,
      netBalanceMinor: 0,
    });
  }

  // Aggregate expenses paid
  for (const expense of params.expenses) {
    const b = balances.get(expense.paidByMemberId);
    if (b) {
      b.totalPaidMinor += expense.amountMinor;
    }
  }

  // Aggregate splits owed
  for (const split of params.splits) {
    const b = balances.get(split.memberId);
    if (b) {
      b.totalOwedMinor += split.shareMinor;
    }
  }

  // Aggregate settlements
  for (const settlement of params.settlements) {
    const fromB = balances.get(settlement.fromMemberId);
    if (fromB) {
      fromB.settledOutMinor += settlement.amountMinor;
    }
    const toB = balances.get(settlement.toMemberId);
    if (toB) {
      toB.settledInMinor += settlement.amountMinor;
    }
  }

  // Finalize net balances
  for (const b of balances.values()) {
    b.netBalanceMinor =
      b.totalPaidMinor - b.totalOwedMinor + b.settledOutMinor - b.settledInMinor;
  }

  return balances;
}

/**
 * Computes the MINIMAL settle-up payment plan (fewest transactions to clear all debts).
 * 
 * Uses a greedy bipartite matching algorithm:
 * Continually pairs the largest debtor with the largest creditor.
 */
export function calculateMinimalSettlements(
  balances: Map<string, MemberBalance> | Record<string, number>
): SettlementPayment[] {
  interface Account {
    memberId: string;
    amount: number;
  }

  const debtors: Account[] = [];
  const creditors: Account[] = [];

  const entries: [string, number][] =
    balances instanceof Map
      ? Array.from(balances.entries()).map(([k, v]) => [k, v.netBalanceMinor])
      : Object.entries(balances);

  for (const [memberId, balanceMinor] of entries) {
    if (balanceMinor < 0) {
      debtors.push({ memberId, amount: -balanceMinor }); // debt as positive value
    } else if (balanceMinor > 0) {
      creditors.push({ memberId, amount: balanceMinor });
    }
  }

  // Sort descending by amount
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const payments: SettlementPayment[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const paymentAmount = Math.min(debtor.amount, creditor.amount);

    if (paymentAmount > 0) {
      payments.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amountMinor: paymentAmount,
      });

      debtor.amount -= paymentAmount;
      creditor.amount -= paymentAmount;
    }

    if (debtor.amount === 0) {
      dIdx++;
    }
    if (creditor.amount === 0) {
      cIdx++;
    }
  }

  return payments;
}

/**
 * Formats integer minor units to user-friendly currency string (e.g. 1050 -> "$10.50").
 */
export function formatCurrency(amountMinor: number, currency = 'USD'): string {
  const isNegative = amountMinor < 0;
  const absAmount = Math.abs(amountMinor);
  const units = Math.floor(absAmount / 100);
  const decimals = (absAmount % 100).toString().padStart(2, '0');

  const symbol =
    currency === 'INR' ? '₹' :
    currency === 'EUR' ? '€' :
    currency === 'GBP' ? '£' : '$';

  return `${isNegative ? '-' : ''}${symbol}${units.toLocaleString()}.${decimals}`;
}
