import { ExpenseRow, MemberRow } from '@/types';

/**
 * Generates an RFC 4180 compliant CSV string representing a group's expenses,
 * with columns for date, description, category, payer, formatted amount, and each member's share.
 */
export function generateExpensesCSV(params: {
  expenses: ExpenseRow[];
  members: MemberRow[];
  currency: string;
}): string {
  const { expenses, members, currency } = params;

  // Escape helper for CSV cells
  const escapeCell = (val: string | number | undefined | null): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // Header row
  const memberHeaders = members.map((m) => `Share: ${m.displayName} (${currency})`);
  const headers = [
    'Date',
    'Description',
    'Category',
    'Paid By',
    `Total Amount (${currency})`,
    ...memberHeaders,
    'Split Type',
  ];

  const rows: string[] = [headers.map(escapeCell).join(',')];

  for (const exp of expenses) {
    const payerName =
      typeof exp.paidBy === 'object'
        ? exp.paidBy?.displayName
        : members.find((m) => m.$id === exp.paidBy)?.displayName || 'Unknown';

    const formattedAmount = (exp.amountMinor / 100).toFixed(2);
    const dateStr = exp.expenseDate ? exp.expenseDate.split('T')[0] : '';

    // Per-member shares
    const memberShares = members.map((m) => {
      const match = exp.splits?.find(
        (s) => (typeof s.member === 'object' ? s.member.$id : s.member) === m.$id
      );
      return match ? (match.shareMinor / 100).toFixed(2) : '0.00';
    });

    const row = [
      dateStr,
      exp.description,
      exp.category,
      payerName,
      formattedAmount,
      ...memberShares,
      exp.splitType,
    ];

    rows.push(row.map(escapeCell).join(','));
  }

  return rows.join('\r\n');
}

/**
 * Triggers a client-side file download of the CSV data.
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
