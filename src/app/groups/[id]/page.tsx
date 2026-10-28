'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { getAppwriteClient, APPWRITE_CONFIG } from '@/lib/appwrite/client';
import { Query, Channel } from 'appwrite';
import {
  GroupRow,
  MemberRow,
  ExpenseRow,
  SplitRow,
  SettlementRow,
  ExpenseCategory,
} from '@/types';
import {
  calculateEqualSplits,
  validateCustomSplits,
  calculateBalances,
  calculateMinimalSettlements,
  formatCurrency,
} from '@/lib/split-engine';
import confetti from 'canvas-confetti';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Receipt,
  Scale,
  HandCoins,
  Users,
  Copy,
  Check,
  Calendar,
  Tag,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit2,
  Loader2,
  AlertCircle,
  X,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

const CATEGORIES: { label: string; value: ExpenseCategory }[] = [
  { label: 'Groceries', value: 'groceries' },
  { label: 'Rent', value: 'rent' },
  { label: 'Utilities', value: 'utilities' },
  { label: 'Food & Dining', value: 'food' },
  { label: 'Travel', value: 'travel' },
  { label: 'Entertainment', value: 'entertainment' },
  { label: 'Other', value: 'other' },
];

function GroupDetailContent() {
  const { user, loading: authLoading, getJWT } = useAuth();
  const params = useParams();
  const router = useRouter();
  const groupId = (params?.id as string) || '';

  const [group, setGroup] = useState<GroupRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);

  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'settle' | 'members'>('expenses');
  const [loading, setLoading] = useState(true);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Pagination for expenses
  const [page, setPage] = useState(1);
  const limit = 10;
  const [totalExpenses, setTotalExpenses] = useState(0);

  // Expanded splits accordion in expense list
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);

  // Expense Modal State
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [desc, setDesc] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('groceries');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidByMemberId, setPaidByMemberId] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Protected route guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Load Group Metadata & Members
  const loadGroupAndMembers = useCallback(async () => {
    if (!groupId) return;
    try {
      const { tablesDB } = getAppwriteClient();
      const groupData = await tablesDB.getRow<GroupRow>({
        databaseId: APPWRITE_CONFIG.databaseId,
        tableId: APPWRITE_CONFIG.tables.groups,
        rowId: groupId,
      });
      setGroup(groupData);

      const membersData = await tablesDB.listRows<MemberRow>({
        databaseId: APPWRITE_CONFIG.databaseId,
        tableId: APPWRITE_CONFIG.tables.members,
        queries: [
          Query.equal('group', [groupId]),
          Query.limit(100),
        ],
      });
      setMembers(membersData.rows);
      if (membersData.rows.length > 0 && !paidByMemberId) {
        setPaidByMemberId(membersData.rows[0].$id);
      }
    } catch (err: any) {
      console.error('Error loading group:', err);
    }
  }, [groupId, paidByMemberId]);

  // Load Expenses with Relationships
  const loadExpenses = useCallback(async () => {
    if (!groupId) return;
    try {
      const { tablesDB } = getAppwriteClient();
      const offset = (page - 1) * limit;

      const res = await tablesDB.listRows<ExpenseRow>({
        databaseId: APPWRITE_CONFIG.databaseId,
        tableId: APPWRITE_CONFIG.tables.expenses,
        queries: [
          Query.equal('group', [groupId]),
          Query.orderDesc('expenseDate'),
          Query.limit(limit),
          Query.offset(offset),
          Query.select(['*', 'paidBy.*', 'splits.*']),
        ],
      });
      setExpenses(res.rows);
      setTotalExpenses(res.total);
    } catch (err: any) {
      console.error('Error loading expenses:', err);
    }
  }, [groupId, page, limit]);

  // Load All Splits and Settlements for Balance Calculation
  const loadLedgerData = useCallback(async () => {
    if (!groupId) return;
    try {
      const { tablesDB } = getAppwriteClient();

      // All expenses for balance calculation
      const allExpensesRes = await tablesDB.listRows<ExpenseRow>({
        databaseId: APPWRITE_CONFIG.databaseId,
        tableId: APPWRITE_CONFIG.tables.expenses,
        queries: [Query.equal('group', [groupId]), Query.limit(500)],
      });

      // All splits
      const allSplitsRes = await tablesDB.listRows<SplitRow>({
        databaseId: APPWRITE_CONFIG.databaseId,
        tableId: APPWRITE_CONFIG.tables.splits,
        queries: [Query.limit(2000), Query.select(['*', 'expense.*', 'member.*'])],
      });

      // All settlements for this group
      const allSettlementsRes = await tablesDB.listRows<SettlementRow>({
        databaseId: APPWRITE_CONFIG.databaseId,
        tableId: APPWRITE_CONFIG.tables.settlements,
        queries: [
          Query.equal('group', [groupId]),
          Query.orderDesc('settledAt'),
          Query.limit(200),
          Query.select(['*', 'fromMember.*', 'toMember.*']),
        ],
      });

      setSplits(allSplitsRes.rows);
      setSettlements(allSettlementsRes.rows);
    } catch (err: any) {
      console.error('Error loading ledger data:', err);
    }
  }, [groupId]);

  // Initial Data Fetch
  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadGroupAndMembers();
      await loadExpenses();
      await loadLedgerData();
      setLoading(false);
    }
    if (groupId) {
      init();
    }
  }, [groupId, loadGroupAndMembers, loadExpenses, loadLedgerData]);

  // Realtime Subscription with Polling Fallback
  useEffect(() => {
    if (!groupId) return;

    let subPromise: Promise<any> | null = null;
    try {
      const { realtime } = getAppwriteClient();
      const channelExpenses = Channel.tablesdb(APPWRITE_CONFIG.databaseId)
        .table(APPWRITE_CONFIG.tables.expenses)
        .row();
      const channelSettlements = Channel.tablesdb(APPWRITE_CONFIG.databaseId)
        .table(APPWRITE_CONFIG.tables.settlements)
        .row();

      subPromise = realtime.subscribe(
        [channelExpenses, channelSettlements],
        () => {
          loadExpenses();
          loadLedgerData();
        }
      );
    } catch (e) {
      console.warn('Realtime subscription not supported on this client, using polling:', e);
    }

    // 8-second polling fallback while tab is focused
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadExpenses();
        loadLedgerData();
      }
    }, 8000);

    return () => {
      if (subPromise) {
        subPromise.then((sub) => {
          if (sub && typeof sub.unsubscribe === 'function') {
            sub.unsubscribe();
          } else if (sub && typeof sub.close === 'function') {
            sub.close();
          }
        }).catch(() => {});
      }
      clearInterval(interval);
    };
  }, [groupId, loadExpenses, loadLedgerData]);

  // Compute Balances using Pure Split Engine Function
  const balances = useMemo(() => {
    if (members.length === 0) return new Map();

    const memberIds = members.map((m) => m.$id);

    const expensesForBalance = expenses.map((e) => ({
      paidByMemberId: typeof e.paidBy === 'object' ? e.paidBy.$id : (e.paidBy as string),
      amountMinor: e.amountMinor,
    }));

    const splitsForBalance = splits.map((s) => ({
      memberId: typeof s.member === 'object' ? s.member.$id : (s.member as string),
      shareMinor: s.shareMinor,
    }));

    const settlementsForBalance = settlements.map((s) => ({
      fromMemberId: typeof s.fromMember === 'object' ? s.fromMember.$id : (s.fromMember as string),
      toMemberId: typeof s.toMember === 'object' ? s.toMember.$id : (s.toMember as string),
      amountMinor: s.amountMinor,
    }));

    return calculateBalances({
      memberIds,
      expenses: expensesForBalance,
      splits: splitsForBalance,
      settlements: settlementsForBalance,
    });
  }, [members, expenses, splits, settlements]);

  // Compute Minimal Settle-Up Payment Plan
  const settleUpPlan = useMemo(() => {
    if (balances.size === 0) return [];
    return calculateMinimalSettlements(balances);
  }, [balances]);

  // Copy Invite Code helper
  const handleCopyInvite = () => {
    if (!group?.inviteCode) return;
    navigator.clipboard.writeText(group.inviteCode);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  // Open Create Expense Modal
  const openAddExpenseModal = () => {
    setEditingExpense(null);
    setDesc('');
    setAmountStr('');
    setCategory('groceries');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setSplitType('equal');
    setExpenseError(null);
    if (members.length > 0) setPaidByMemberId(members[0].$id);

    // Initial equal custom shares
    const initialShares: Record<string, string> = {};
    members.forEach((m) => (initialShares[m.$id] = ''));
    setCustomShares(initialShares);

    setExpenseModalOpen(true);
  };

  // Open Edit Expense Modal
  const openEditExpenseModal = (exp: ExpenseRow) => {
    setEditingExpense(exp);
    setDesc(exp.description);
    setAmountStr((exp.amountMinor / 100).toFixed(2));
    setCategory(exp.category);
    setExpenseDate(exp.expenseDate.split('T')[0]);
    setPaidByMemberId(typeof exp.paidBy === 'object' ? exp.paidBy.$id : (exp.paidBy as string));
    setSplitType(exp.splitType);
    setExpenseError(null);

    // Populate existing splits
    const initialShares: Record<string, string> = {};
    members.forEach((m) => {
      const match = exp.splits?.find((s) =>
        (typeof s.member === 'object' ? s.member.$id : s.member) === m.$id
      );
      initialShares[m.$id] = match ? (match.shareMinor / 100).toFixed(2) : '0';
    });
    setCustomShares(initialShares);

    setExpenseModalOpen(true);
  };

  // Submit Expense Form (Create or Edit)
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError(null);
    setExpenseSubmitting(true);

    try {
      const amountVal = parseFloat(amountStr);
      if (isNaN(amountVal) || amountVal <= 0) {
        throw new Error('Please enter a valid expense amount greater than 0');
      }

      const totalAmountMinor = Math.round(amountVal * 100);
      const participantMemberIds = members.map((m) => m.$id);

      let computedSplits: { memberId: string; shareMinor: number }[] = [];

      if (splitType === 'equal') {
        computedSplits = calculateEqualSplits(totalAmountMinor, participantMemberIds);
      } else {
        computedSplits = members.map((m) => {
          const val = parseFloat(customShares[m.$id] || '0');
          return {
            memberId: m.$id,
            shareMinor: Math.round(val * 100),
          };
        });

        const validation = validateCustomSplits(totalAmountMinor, computedSplits);
        if (!validation.valid) {
          throw new Error(validation.error || 'Custom shares must sum exactly to the total amount');
        }
      }

      const jwt = await getJWT();
      const payload = {
        groupId,
        description: desc.trim(),
        amountMinor: totalAmountMinor,
        category,
        expenseDate: new Date(expenseDate).toISOString(),
        paidByMemberId,
        splitType,
        splits: computedSplits,
      };

      let res: Response;
      if (editingExpense) {
        res = await fetch(`/api/expenses/${editingExpense.$id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/expenses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save expense');
      }

      setExpenseModalOpen(false);
      await loadExpenses();
      await loadLedgerData();
    } catch (err: any) {
      console.error(err);
      setExpenseError(err.message || 'Error saving expense');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense? All associated splits will be removed.')) {
      return;
    }

    try {
      const jwt = await getJWT();
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete expense');
      }

      await loadExpenses();
      await loadLedgerData();
    } catch (err: any) {
      alert(`Error deleting expense: ${err.message}`);
    }
  };

  // Mark Settle-Up Payment as Paid
  const handleMarkAsPaid = async (fromMemberId: string, toMemberId: string, amountMinor: number) => {
    try {
      const jwt = await getJWT();
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          groupId,
          fromMemberId,
          toMemberId,
          amountMinor,
          settledAt: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record settlement');
      }

      // Celebrate settlement!
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });

      await loadLedgerData();
    } catch (err: any) {
      alert(`Error recording settlement: ${err.message}`);
    }
  };

  // Custom Split helper totals
  const customSumMinor = useMemo(() => {
    return Object.values(customShares).reduce((acc, str) => {
      const v = parseFloat(str || '0');
      return acc + (isNaN(v) ? 0 : Math.round(v * 100));
    }, 0);
  }, [customShares]);

  const targetAmountMinor = useMemo(() => {
    const v = parseFloat(amountStr || '0');
    return isNaN(v) ? 0 : Math.round(v * 100);
  }, [amountStr]);

  if (loading || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const currencySymbol = group.currency === 'INR' ? '₹' : group.currency === 'EUR' ? '€' : group.currency === 'GBP' ? '£' : '$';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation & Group Title Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="sm:flex sm:items-center sm:justify-between bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {group.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {group.currency}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 flex items-center space-x-2">
                <span>{members.length} members</span>
                <span>•</span>
                <span>Isolated Appwrite Team: {group.teamId}</span>
              </p>
            </div>

            {/* Invite Code Quick Copy */}
            <div className="mt-4 sm:mt-0 flex items-center space-x-2 bg-slate-50 border border-slate-200 p-2 rounded-xl">
              <span className="text-xs text-slate-500 ml-1">Invite Code:</span>
              <span className="font-mono font-bold text-slate-800 text-sm">{group.inviteCode}</span>
              <button
                onClick={handleCopyInvite}
                title="Copy Invite Code"
                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-white rounded-lg transition-all cursor-pointer"
              >
                {copiedInvite ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Four Tab Navigation */}
        <div className="flex space-x-2 border-b border-slate-200 mb-6 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'expenses'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Expenses ({totalExpenses})</span>
          </button>

          <button
            onClick={() => setActiveTab('balances')}
            className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'balances'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Balances</span>
          </button>

          <button
            onClick={() => setActiveTab('settle')}
            className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'settle'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <HandCoins className="w-4 h-4" />
            <span>Settle Up ({settleUpPlan.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('members')}
            className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'members'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Members ({members.length})</span>
          </button>
        </div>

        {/* TAB 1: EXPENSES */}
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Expenses Ledger</h2>
                <p className="text-xs text-slate-500">
                  Transactions committed atomically to TablesDB with row-level security.
                </p>
              </div>

              <button
                onClick={openAddExpenseModal}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Expense</span>
              </button>
            </div>

            {expenses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center max-w-lg mx-auto">
                <Receipt className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900">No expenses recorded yet</h3>
                <p className="text-xs text-slate-500 mt-1 mb-5">
                  Click below to record your first shared expense. Remainder cents will be distributed deterministically.
                </p>
                <button
                  onClick={openAddExpenseModal}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Expense</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((exp) => {
                  const payerName =
                    typeof exp.paidBy === 'object'
                      ? exp.paidBy?.displayName
                      : members.find((m) => m.$id === exp.paidBy)?.displayName || 'Unknown';
                  const isExpanded = expandedExpenseId === exp.$id;

                  return (
                    <div
                      key={exp.$id}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 transition-colors"
                    >
                      <div className="p-4 sm:p-5 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                            <Tag className="w-5 h-5 text-emerald-600" />
                          </div>

                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="text-base font-bold text-slate-900">{exp.description}</h3>
                              <span className="capitalize text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                {exp.category}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center space-x-2">
                              <span>Paid by <strong className="text-slate-700">{payerName}</strong></span>
                              <span>•</span>
                              <span>{new Date(exp.expenseDate).toLocaleDateString()}</span>
                              <span>•</span>
                              <span className="capitalize">{exp.splitType} split</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <span className="text-base sm:text-lg font-extrabold text-slate-900">
                              {formatCurrency(exp.amountMinor, group.currency)}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1 pl-2 border-l border-slate-200">
                            <button
                              onClick={() =>
                                setExpandedExpenseId(isExpanded ? null : exp.$id)
                              }
                              title="Toggle Splits"
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => openEditExpenseModal(exp)}
                              title="Edit Expense"
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp.$id)}
                              title="Delete Expense"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Splits Accordion */}
                      {isExpanded && (
                        <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-200">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                            Participant Shares:
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {members.map((m) => {
                              const match = exp.splits?.find(
                                (s) =>
                                  (typeof s.member === 'object' ? s.member.$id : s.member) ===
                                  m.$id
                              );
                              const share = match ? match.shareMinor : 0;
                              return (
                                <div
                                  key={m.$id}
                                  className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs flex justify-between items-center"
                                >
                                  <span className="font-medium text-slate-700">{m.displayName}:</span>
                                  <span className="font-bold text-slate-900">
                                    {formatCurrency(share, group.currency)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Pagination Controls */}
                {totalExpenses > limit && (
                  <div className="flex items-center justify-between pt-4">
                    <span className="text-xs text-slate-500">
                      Showing {(page - 1) * limit + 1} -{' '}
                      {Math.min(page * limit, totalExpenses)} of {totalExpenses} expenses
                    </span>
                    <div className="flex space-x-2">
                      <button
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
                      >
                        Previous
                      </button>
                      <button
                        disabled={page * limit >= totalExpenses}
                        onClick={() => setPage(page + 1)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BALANCES */}
        {activeTab === 'balances' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Live Balances</h2>
              <p className="text-xs text-slate-500">
                Calculated strictly in integer minor units: Paid − Owed + Settlements.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member) => {
                const b = balances.get(member.$id);
                const net = b ? b.netBalanceMinor : 0;
                const isCreditor = net > 0;
                const isDebtor = net < 0;

                return (
                  <div
                    key={member.$id}
                    className={`rounded-2xl p-5 border shadow-xs transition-all ${
                      isCreditor
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : isDebtor
                        ? 'bg-rose-50/50 border-rose-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                            isCreditor
                              ? 'bg-emerald-600 text-white'
                              : isDebtor
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {member.displayName[0]?.toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">{member.displayName}</h3>
                          <span
                            className={`text-xs font-semibold ${
                              isCreditor
                                ? 'text-emerald-700'
                                : isDebtor
                                ? 'text-rose-700'
                                : 'text-slate-500'
                            }`}
                          >
                            {isCreditor
                              ? 'Gets back money'
                              : isDebtor
                              ? 'Owes money'
                              : 'Settled up'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`text-xl font-extrabold ${
                            isCreditor
                              ? 'text-emerald-700'
                              : isDebtor
                              ? 'text-rose-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {formatCurrency(net, group.currency)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/60 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                      <div>
                        <span className="block text-slate-400">Total Paid</span>
                        <span className="font-semibold text-slate-800">
                          {formatCurrency(b?.totalPaidMinor || 0, group.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-400">Total Owed</span>
                        <span className="font-semibold text-slate-800">
                          {formatCurrency(b?.totalOwedMinor || 0, group.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-400">Settled Net</span>
                        <span className="font-semibold text-slate-800">
                          {formatCurrency(
                            (b?.settledOutMinor || 0) - (b?.settledInMinor || 0),
                            group.currency
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: SETTLE UP */}
        {activeTab === 'settle' && (
          <div className="space-y-6">
            <div className="bg-emerald-900 text-white rounded-2xl p-6 shadow-md">
              <div className="flex items-start space-x-3">
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-base">Greedy Minimal Settle-Up Plan</h3>
                  <p className="text-xs text-emerald-200 mt-1">
                    Instead of circular repayments where everyone pays everyone, our greedy bipartite matching
                    algorithm pairs the largest debtor with the largest creditor to resolve all debts in the fewest possible transfers.
                  </p>
                </div>
              </div>
            </div>

            {settleUpPlan.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center max-w-md mx-auto">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900">All debts are cleared!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Every roommate is settled up. No outstanding balances remain in this group ledger.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">
                  Recommended Payment Transfers ({settleUpPlan.length}):
                </h3>

                {settleUpPlan.map((payment, idx) => {
                  const debtor = members.find((m) => m.$id === payment.fromMemberId)?.displayName || 'Member';
                  const creditor = members.find((m) => m.$id === payment.toMemberId)?.displayName || 'Member';

                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between shadow-xs gap-4"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 text-base font-bold text-slate-900">
                            <span className="text-rose-600">{debtor}</span>
                            <ArrowRight className="w-4 h-4 text-slate-400" />
                            <span className="text-emerald-600">{creditor}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Direct repayment to balance both ledgers
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end space-x-4">
                        <span className="text-xl font-extrabold text-slate-900">
                          {formatCurrency(payment.amountMinor, group.currency)}
                        </span>

                        <button
                          onClick={() =>
                            handleMarkAsPaid(
                              payment.fromMemberId,
                              payment.toMemberId,
                              payment.amountMinor
                            )
                          }
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark as Paid</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Settlements History */}
            {settlements.length > 0 && (
              <div className="mt-10 pt-6 border-t border-slate-200">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-3">
                  Settlement History ({settlements.length})
                </h3>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="divide-y divide-slate-100">
                    {settlements.map((st) => {
                      const fromName =
                        typeof st.fromMember === 'object'
                          ? st.fromMember?.displayName
                          : members.find((m) => m.$id === st.fromMember)?.displayName || 'Unknown';
                      const toName =
                        typeof st.toMember === 'object'
                          ? st.toMember?.displayName
                          : members.find((m) => m.$id === st.toMember)?.displayName || 'Unknown';

                      return (
                        <div key={st.$id} className="p-4 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-800">{fromName}</span> paid{' '}
                            <span className="font-bold text-slate-800">{toName}</span>
                            <span className="block text-slate-400 mt-0.5">
                              {new Date(st.settledAt).toLocaleString()}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-emerald-700">
                            {formatCurrency(st.amountMinor, group.currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MEMBERS */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Group Members</h2>
                <p className="text-xs text-slate-500">
                  Roommates and friends authorized to view and split expenses in this team.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {members.map((member) => (
                <div
                  key={member.$id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                      {member.displayName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{member.displayName}</h3>
                      <p className="text-xs text-slate-400 font-mono">User ID: {member.userId}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    Active
                  </span>
                </div>
              ))}
            </div>

            {/* Invite Code Share Card */}
            <div className="bg-gradient-to-tr from-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 mt-6">
              <h3 className="text-lg font-bold">Invite Roommates to SplitNest</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-md">
                Share this unique invite code with your friends. When they join, they will be automatically added to the Appwrite Team with real-time access.
              </p>

              <div className="mt-5 flex items-center space-x-3 max-w-sm">
                <div className="bg-white/10 border border-white/20 px-4 py-2.5 rounded-xl font-mono font-extrabold text-base tracking-wider flex-1 text-center">
                  {group.inviteCode}
                </div>
                <button
                  onClick={handleCopyInvite}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm cursor-pointer"
                >
                  {copiedInvite ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Add or Edit Expense */}
      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => setExpenseModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingExpense ? 'Edit Expense' : 'Add New Expense'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Atomic transaction will stage the expense row and all participant split rows together.
            </p>

            {expenseError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{expenseError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitExpense} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  required
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g. WiFi Bill or Costco Run"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Amount ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Paid By
                  </label>
                  <select
                    value={paidByMemberId}
                    onChange={(e) => setPaidByMemberId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                  >
                    {members.map((m) => (
                      <option key={m.$id} value={m.$id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Split Type Selector */}
              <div>
                <label className="block font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Split Methodology
                </label>
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSplitType('equal')}
                    className={`w-1/2 py-2 text-xs font-semibold rounded-lg transition-all ${
                      splitType === 'equal'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Split Equally
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitType('custom')}
                    className={`w-1/2 py-2 text-xs font-semibold rounded-lg transition-all ${
                      splitType === 'custom'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Custom Amounts
                  </button>
                </div>
              </div>

              {/* Split Preview / Custom Inputs */}
              {splitType === 'equal' ? (
                <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-emerald-900">Equal Distribution Preview:</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full font-medium">
                      Exact minor unit remainder distributed
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-700">
                    {members.map((m) => {
                      const shareVal = targetAmountMinor > 0 ? (targetAmountMinor / members.length / 100).toFixed(2) : '0.00';
                      return (
                        <div key={m.$id} className="flex justify-between items-center text-xs">
                          <span>{m.displayName}</span>
                          <span className="font-bold">{currencySymbol}{shareVal}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-700">Enter custom share per person:</span>
                    <span
                      className={`text-xs font-bold ${
                        customSumMinor === targetAmountMinor
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}
                    >
                      Sum: {formatCurrency(customSumMinor, group.currency)} / {formatCurrency(targetAmountMinor, group.currency)}
                    </span>
                  </div>

                  {members.map((m) => (
                    <div key={m.$id} className="flex items-center justify-between space-x-2">
                      <span className="text-slate-700 font-medium text-xs w-1/3 truncate">
                        {m.displayName}
                      </span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2 text-slate-400 font-medium text-xs">
                          {currencySymbol}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={customShares[m.$id] || ''}
                          onChange={(e) =>
                            setCustomShares({
                              ...customShares,
                              [m.$id]: e.target.value,
                            })
                          }
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                        />
                      </div>
                    </div>
                  ))}

                  {customSumMinor !== targetAmountMinor && (
                    <p className="text-[11px] text-amber-700 pt-1">
                      Difference: {formatCurrency(targetAmountMinor - customSumMinor, group.currency)} remaining to assign.
                    </p>
                  )}
                </div>
              )}

              <div className="pt-3 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseSubmitting || (splitType === 'custom' && customSumMinor !== targetAmountMinor)}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  {expenseSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingExpense ? 'Update Expense' : 'Save Expense Atomically'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GroupDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      }
    >
      <GroupDetailContent />
    </Suspense>
  );
}
