import { Query } from 'appwrite';

export interface ExpenseFilterParams {
  groupId: string;
  category?: string;
  paidByMemberId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  minAmountMinor?: number;
  maxAmountMinor?: number;
  sortBy?: 'newest' | 'oldest' | 'highest' | 'lowest';
  limit?: number;
  offset?: number;
}

/**
 * Builds typed Appwrite TablesDB queries for the expenses table.
 * Uses exact Query operators: equal, search (fulltext), greaterThanEqual, lessThanEqual, orderDesc, orderAsc, select, limit, offset.
 */
export function buildExpenseQueries(params: ExpenseFilterParams): string[] {
  const queries: string[] = [Query.equal('group', [params.groupId])];

  // Category filter (backed by idx_expenses_category)
  if (params.category && params.category !== 'all') {
    queries.push(Query.equal('category', [params.category]));
  }

  // Payer relationship filter
  if (params.paidByMemberId && params.paidByMemberId !== 'all') {
    queries.push(Query.equal('paidBy', [params.paidByMemberId]));
  }

  // Fulltext description search (backed by idx_expenses_description_search)
  if (params.search && params.search.trim().length > 0) {
    queries.push(Query.search('description', params.search.trim()));
  }

  // Date range filters (backed by idx_expenses_group_date)
  if (params.startDate) {
    queries.push(Query.greaterThanEqual('expenseDate', params.startDate));
  }
  if (params.endDate) {
    // Append end of day if only date is passed
    const endIso = params.endDate.includes('T')
      ? params.endDate
      : `${params.endDate}T23:59:59.999Z`;
    queries.push(Query.lessThanEqual('expenseDate', endIso));
  }

  // Amount range filters (backed by idx_expenses_amount)
  if (params.minAmountMinor !== undefined && params.minAmountMinor > 0) {
    queries.push(Query.greaterThanEqual('amountMinor', params.minAmountMinor));
  }
  if (params.maxAmountMinor !== undefined && params.maxAmountMinor > 0) {
    queries.push(Query.lessThanEqual('amountMinor', params.maxAmountMinor));
  }

  // Sorting
  switch (params.sortBy) {
    case 'oldest':
      queries.push(Query.orderAsc('expenseDate'));
      break;
    case 'highest':
      queries.push(Query.orderDesc('amountMinor'));
      break;
    case 'lowest':
      queries.push(Query.orderAsc('amountMinor'));
      break;
    case 'newest':
    default:
      queries.push(Query.orderDesc('expenseDate'));
      break;
  }

  // Pagination
  if (params.limit !== undefined && params.limit > 0) {
    queries.push(Query.limit(params.limit));
  }
  if (params.offset !== undefined && params.offset >= 0) {
    queries.push(Query.offset(params.offset));
  }

  // Opt-in loading of related rows (paidBy and splits)
  queries.push(Query.select(['*', 'paidBy.*', 'splits.*']));

  return queries;
}
