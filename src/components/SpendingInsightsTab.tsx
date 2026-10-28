'use client';

import React from 'react';
import { ExpenseRow, MemberRow, SplitRow } from '@/types';
import {
  calculateCategorySpending,
  calculateMemberSpending,
  calculateTimelineSpending,
  calculateSpendingSummary,
} from '@/lib/spending-insights';
import { formatCurrency } from '@/lib/split-engine';
import {
  PieChart,
  BarChart3,
  Calendar,
  Wallet,
  Receipt,
  UserCheck,
  Tag,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';

interface SpendingInsightsTabProps {
  expenses: ExpenseRow[];
  members: MemberRow[];
  splits: SplitRow[];
  currency: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; fill: string }> = {
  groceries: { bg: 'bg-emerald-100', text: 'text-emerald-800', fill: '#10b981' },
  rent: { bg: 'bg-indigo-100', text: 'text-indigo-800', fill: '#6366f1' },
  utilities: { bg: 'bg-amber-100', text: 'text-amber-800', fill: '#f59e0b' },
  food: { bg: 'bg-orange-100', text: 'text-orange-800', fill: '#f97316' },
  travel: { bg: 'bg-cyan-100', text: 'text-cyan-800', fill: '#06b6d4' },
  entertainment: { bg: 'bg-purple-100', text: 'text-purple-800', fill: '#a855f7' },
  other: { bg: 'bg-slate-100', text: 'text-slate-800', fill: '#64748b' },
};

export function SpendingInsightsTab({
  expenses,
  members,
  splits,
  currency,
}: SpendingInsightsTabProps) {
  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center max-w-lg mx-auto shadow-xs">
        <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 mb-1">No spending data yet</h3>
        <p className="text-xs text-slate-500">
          Once expenses are recorded in this group ledger, automatic category breakdowns and per-member consumption charts will appear here.
        </p>
      </div>
    );
  }

  // Prepared data
  const summaryExpenses = expenses.map((e) => ({
    category: e.category,
    amountMinor: e.amountMinor,
    paidByMemberId: typeof e.paidBy === 'object' ? e.paidBy.$id : (e.paidBy as string),
  }));

  const summary = calculateSpendingSummary(summaryExpenses, members.map((m) => ({ id: m.$id, displayName: m.displayName })));
  const categorySpending = calculateCategorySpending(expenses);
  const memberSpending = calculateMemberSpending(
    members.map((m) => ({ id: m.$id, displayName: m.displayName })),
    summaryExpenses,
    splits.map((s) => ({
      memberId: typeof s.member === 'object' ? s.member.$id : (s.member as string),
      shareMinor: s.shareMinor,
    }))
  );
  const timelineSpending = calculateTimelineSpending(expenses);

  // SVG Donut calculation
  let cumulativeAngle = 0;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="space-y-8">
      {/* Accessible Summary Card */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-md">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
          Ledger Analytics Overview
        </span>
        <h2 className="text-2xl font-extrabold tracking-tight">Spending Insights</h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
          Your group has recorded a total of{' '}
          <strong className="text-white font-bold">{formatCurrency(summary.totalSpendingMinor, currency)}</strong> across{' '}
          <strong className="text-white font-bold">{summary.expenseCount}</strong> expenses (average{' '}
          <strong className="text-white font-bold">{formatCurrency(summary.averageExpenseMinor, currency)}</strong> per expense).{' '}
          {summary.highestCategory && (
            <>
              The largest category is <strong className="text-emerald-300 capitalize">{summary.highestCategory}</strong>.{' '}
            </>
          )}
          {summary.topPayer && (
            <>
              <strong className="text-emerald-300">{summary.topPayer}</strong> has paid the most upfront for the group.
            </>
          )}
        </p>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-500 mb-2">
            <Wallet className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold uppercase tracking-wider">Total Spending</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {formatCurrency(summary.totalSpendingMinor, currency)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-500 mb-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold uppercase tracking-wider">Average Expense</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {formatCurrency(summary.averageExpenseMinor, currency)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-500 mb-2">
            <Tag className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-semibold uppercase tracking-wider">Top Category</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 capitalize truncate">
            {summary.highestCategory || 'N/A'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-500 mb-2">
            <UserCheck className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold uppercase tracking-wider">Top Payer</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 truncate">
            {summary.topPayer || 'N/A'}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown (Donut Chart) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <PieChart className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">Category Breakdown</h3>
            </div>
            <span className="text-xs text-slate-500">{categorySpending.length} categories</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2">
            {/* SVG Donut */}
            <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="20"
                />
                {categorySpending.map((cat, idx) => {
                  const strokeDasharray = `${(cat.percentage / 100) * circumference} ${circumference}`;
                  const strokeDashoffset = -cumulativeAngle;
                  cumulativeAngle += (cat.percentage / 100) * circumference;
                  const color = CATEGORY_COLORS[cat.category]?.fill || '#64748b';

                  return (
                    <circle
                      key={idx}
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="none"
                      stroke={color}
                      strokeWidth="20"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-500"
                    />
                  );
                })}
              </svg>
              <div className="absolute text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Top Cat
                </span>
                <span className="text-sm font-extrabold text-slate-900 capitalize block">
                  {categorySpending[0]?.category}
                </span>
                <span className="text-xs font-semibold text-emerald-600">
                  {categorySpending[0]?.percentage}%
                </span>
              </div>
            </div>

            {/* Category Progress Bars */}
            <div className="flex-1 w-full space-y-3">
              {categorySpending.map((cat) => {
                const color = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.other;
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700 capitalize flex items-center space-x-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: color.fill }}
                        ></span>
                        <span>{cat.category}</span>
                      </span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(cat.amountMinor, currency)} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: color.fill,
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Member Spending: Paid vs Consumed */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-teal-600" />
              <h3 className="text-base font-bold text-slate-900">Paid vs. Consumed Share</h3>
            </div>
            <span className="text-xs text-slate-500">Per Roommate</span>
          </div>

          <div className="space-y-4 pt-2">
            {memberSpending.map((m) => {
              const maxAmount = Math.max(
                ...memberSpending.map((item) => Math.max(item.totalPaidMinor, item.totalShareMinor)),
                1
              );
              const paidPercent = Math.round((m.totalPaidMinor / maxAmount) * 100);
              const sharePercent = Math.round((m.totalShareMinor / maxAmount) * 100);

              return (
                <div key={m.memberId} className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-sm text-slate-900">{m.displayName}</span>
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                        m.netMinor >= 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {m.netMinor >= 0 ? '+' : ''}
                      {formatCurrency(m.netMinor, currency)}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-600 mb-0.5">
                        <span>Paid Upfront:</span>
                        <span className="font-semibold">{formatCurrency(m.totalPaidMinor, currency)}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div
                          className="bg-emerald-600 h-1.5 rounded-full"
                          style={{ width: `${paidPercent}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-600 mb-0.5">
                        <span>Assigned Consumption:</span>
                        <span className="font-semibold">{formatCurrency(m.totalShareMinor, currency)}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div
                          className="bg-teal-500 h-1.5 rounded-full"
                          style={{ width: `${sharePercent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Spending Over Time */}
      {timelineSpending.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Spending Over Time</h3>
          </div>

          <div className="pt-4 flex items-end justify-between space-x-3 h-48 border-b border-slate-200 pb-2">
            {timelineSpending.map((t, idx) => {
              const maxSpend = Math.max(...timelineSpending.map((item) => item.amountMinor), 1);
              const heightPercent = Math.max(Math.round((t.amountMinor / maxSpend) * 100), 8);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md shadow-xs mb-1">
                    {formatCurrency(t.amountMinor, currency)}
                  </div>
                  <div
                    className="w-full max-w-[48px] bg-emerald-600 hover:bg-emerald-500 rounded-t-lg transition-all"
                    style={{ height: `${heightPercent}%` }}
                  ></div>
                  <span className="text-[10px] font-medium text-slate-500 mt-2 truncate w-full text-center">
                    {t.period}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
