import { Models } from 'appwrite';

export interface GroupRow extends Models.DefaultRow {
  name: string;
  currency: string;
  inviteCode: string;
  teamId: string;
  createdBy: string;
}

export interface MemberRow extends Models.DefaultRow {
  displayName: string;
  userId: string;
  group?: GroupRow | string;
}

export type ExpenseCategory =
  | 'groceries'
  | 'rent'
  | 'utilities'
  | 'food'
  | 'travel'
  | 'entertainment'
  | 'other';

export interface ExpenseRow extends Models.DefaultRow {
  description: string;
  amountMinor: number;
  category: ExpenseCategory;
  expenseDate: string;
  splitType: 'equal' | 'custom';
  group?: GroupRow | string;
  paidBy?: MemberRow | string;
  splits?: SplitRow[];
}

export interface SplitRow extends Models.DefaultRow {
  shareMinor: number;
  expense?: ExpenseRow | string;
  member?: MemberRow | string;
}

export interface SettlementRow extends Models.DefaultRow {
  amountMinor: number;
  settledAt: string;
  group?: GroupRow | string;
  fromMember?: MemberRow | string;
  toMember?: MemberRow | string;
}

export interface CustomSplitInput {
  memberId: string;
  shareMinor: number;
}
