/**
 * SplitNest Spending Insights Engine
 * Pure, unit-testable aggregation functions for group expense analysis.
 */

export interface CategorySpending {
  category: string;
  amountMinor: number;
  percentage: number;
}

export interface MemberSpending {
  memberId: string;
  displayName: string;
  totalPaidMinor: number;
  totalShareMinor: number;
  netMinor: number; // positive = paid more than consumed
}

export interface TimelineSpending {
  period: string; // e.g. "Week of Oct 14" or "2026-10"
  amountMinor: number;
}

export interface SpendingSummary {
  totalSpendingMinor: number;
  expenseCount: number;
  averageExpenseMinor: number;
  highestCategory: string | null;
  topPayer: string | null;
}

/**
 * Aggregates group spending by category, computing totals and percentage of ledger.
 */
export function calculateCategorySpending(
  expenses: { category?: string; amountMinor: number }[]
): CategorySpending[] {
  if (!expenses || expenses.length === 0) return [];

  const categoryTotals = new Map<string, number>();
  let totalAll = 0;

  for (const exp of expenses) {
    const cat = exp.category || 'other';
    const current = categoryTotals.get(cat) || 0;
    categoryTotals.set(cat, current + exp.amountMinor);
    totalAll += exp.amountMinor;
  }

  if (totalAll === 0) return [];

  const result: CategorySpending[] = [];
  for (const [category, amountMinor] of categoryTotals.entries()) {
    result.push({
      category,
      amountMinor,
      percentage: Math.round((amountMinor / totalAll) * 100),
    });
  }

  // Sort descending by amount
  result.sort((a, b) => b.amountMinor - a.amountMinor);
  return result;
}

/**
 * Computes per-person spending: what each member paid out-of-pocket vs. their total consumption share.
 */
export function calculateMemberSpending(
  members: { id: string; displayName: string }[],
  expenses: { paidByMemberId: string; amountMinor: number }[],
  splits: { memberId: string; shareMinor: number }[]
): MemberSpending[] {
  if (!members || members.length === 0) return [];

  const memberMap = new Map<
    string,
    { displayName: string; totalPaidMinor: number; totalShareMinor: number }
  >();

  for (const m of members) {
    memberMap.set(m.id, {
      displayName: m.displayName,
      totalPaidMinor: 0,
      totalShareMinor: 0,
    });
  }

  for (const exp of expenses) {
    const m = memberMap.get(exp.paidByMemberId);
    if (m) {
      m.totalPaidMinor += exp.amountMinor;
    }
  }

  for (const s of splits) {
    const m = memberMap.get(s.memberId);
    if (m) {
      m.totalShareMinor += s.shareMinor;
    }
  }

  const result: MemberSpending[] = [];
  for (const [memberId, stats] of memberMap.entries()) {
    result.push({
      memberId,
      displayName: stats.displayName,
      totalPaidMinor: stats.totalPaidMinor,
      totalShareMinor: stats.totalShareMinor,
      netMinor: stats.totalPaidMinor - stats.totalShareMinor,
    });
  }

  // Sort descending by total paid
  result.sort((a, b) => b.totalPaidMinor - a.totalPaidMinor);
  return result;
}

/**
 * Groups expenses over time by calendar week.
 */
export function calculateTimelineSpending(
  expenses: { expenseDate: string; amountMinor: number }[]
): TimelineSpending[] {
  if (!expenses || expenses.length === 0) return [];

  // Sort chronologically
  const sorted = [...expenses].sort(
    (a, b) => new Date(a.expenseDate).getTime() - new Date(b.expenseDate).getTime()
  );

  const weekMap = new Map<string, number>();

  for (const exp of sorted) {
    const d = new Date(exp.expenseDate);
    if (isNaN(d.getTime())) continue;

    // Format week start date (YYYY-MM-DD of Monday)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const label = `${monday.toLocaleString('default', { month: 'short' })} ${monday.getDate()}`;

    weekMap.set(label, (weekMap.get(label) || 0) + exp.amountMinor);
  }

  return Array.from(weekMap.entries()).map(([period, amountMinor]) => ({
    period,
    amountMinor,
  }));
}

/**
 * Computes high-level spending summary for accessible text descriptions.
 */
export function calculateSpendingSummary(
  expenses: { category?: string; amountMinor: number; paidByMemberId: string }[],
  members: { id: string; displayName: string }[]
): SpendingSummary {
  const totalSpendingMinor = expenses.reduce((acc, e) => acc + e.amountMinor, 0);
  const expenseCount = expenses.length;
  const averageExpenseMinor =
    expenseCount > 0 ? Math.round(totalSpendingMinor / expenseCount) : 0;

  const categories = calculateCategorySpending(expenses);
  const highestCategory = categories.length > 0 ? categories[0].category : null;

  const memberSpending = calculateMemberSpending(members, expenses, []);
  const topPayer = memberSpending.length > 0 ? memberSpending[0].displayName : null;

  return {
    totalSpendingMinor,
    expenseCount,
    averageExpenseMinor,
    highestCategory,
    topPayer,
  };
}
