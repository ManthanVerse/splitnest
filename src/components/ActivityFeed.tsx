'use client';

import React from 'react';
import { GroupRow, MemberRow, ExpenseRow, SettlementRow } from '@/types';
import { formatCurrency } from '@/lib/split-engine';
import { Receipt, HandCoins, UserPlus, Clock } from 'lucide-react';

export interface ActivityEvent {
  id: string;
  type: 'expense' | 'settlement' | 'member';
  timestamp: string;
  title: string;
  subtitle: string;
  amountMinor?: number;
}

interface ActivityFeedProps {
  group: GroupRow;
  members: MemberRow[];
  expenses: ExpenseRow[];
  settlements: SettlementRow[];
}

export function ActivityFeed({
  group,
  members,
  expenses,
  settlements,
}: ActivityFeedProps) {
  // Aggregate events from existing TablesDB rows
  const events: ActivityEvent[] = React.useMemo(() => {
    const list: ActivityEvent[] = [];

    // 1. Members joined
    members.forEach((m) => {
      list.push({
        id: `member-${m.$id}`,
        type: 'member',
        timestamp: m.$createdAt || new Date().toISOString(),
        title: `${m.displayName} joined the group`,
        subtitle: `Added to Appwrite Team "${group.name}"`,
      });
    });

    // 2. Expenses logged
    expenses.forEach((exp) => {
      const payerName =
        typeof exp.paidBy === 'object'
          ? exp.paidBy?.displayName
          : members.find((m) => m.$id === exp.paidBy)?.displayName || 'Someone';

      list.push({
        id: `expense-${exp.$id}`,
        type: 'expense',
        timestamp: exp.expenseDate || exp.$createdAt,
        title: `${payerName} paid for ${exp.description}`,
        subtitle: `Category: ${exp.category} • ${exp.splitType} split`,
        amountMinor: exp.amountMinor,
      });
    });

    // 3. Settlements executed
    settlements.forEach((st) => {
      const fromName =
        typeof st.fromMember === 'object'
          ? st.fromMember?.displayName
          : members.find((m) => m.$id === st.fromMember)?.displayName || 'Someone';
      const toName =
        typeof st.toMember === 'object'
          ? st.toMember?.displayName
          : members.find((m) => m.$id === st.toMember)?.displayName || 'Someone';

      list.push({
        id: `settlement-${st.$id}`,
        type: 'settlement',
        timestamp: st.settledAt || st.$createdAt,
        title: `${fromName} paid ${toName}`,
        subtitle: 'Debt settlement confirmed',
        amountMinor: st.amountMinor,
      });
    });

    // Sort descending by timestamp
    return list.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [group, members, expenses, settlements]);

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">No recent activity</p>
        <p className="text-xs text-slate-400 mt-1">Actions in this group will appear here in chronological order.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Activity Feed ({events.length})
          </h3>
        </div>
        <span className="text-[11px] text-slate-400 font-medium">Chronological Audit Log</span>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {events.slice(0, 30).map((ev) => {
          const dateObj = new Date(ev.timestamp);
          const dateFormatted = isNaN(dateObj.getTime())
            ? 'Recent'
            : dateObj.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

          return (
            <div key={ev.id} className="relative group">
              {/* Event Marker Node */}
              <div
                className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white shadow-xs ${
                  ev.type === 'expense'
                    ? 'bg-emerald-500'
                    : ev.type === 'settlement'
                    ? 'bg-blue-500'
                    : 'bg-amber-500'
                }`}
              >
                {ev.type === 'expense' ? (
                  <Receipt className="w-2.5 h-2.5" />
                ) : ev.type === 'settlement' ? (
                  <HandCoins className="w-2.5 h-2.5" />
                ) : (
                  <UserPlus className="w-2.5 h-2.5" />
                )}
              </div>

              {/* Event Content */}
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{ev.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">{ev.subtitle}</p>
                  <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">
                    {dateFormatted}
                  </span>
                </div>

                {ev.amountMinor !== undefined && (
                  <span
                    className={`text-xs font-extrabold ${
                      ev.type === 'settlement' ? 'text-blue-600' : 'text-slate-900'
                    }`}
                  >
                    {formatCurrency(ev.amountMinor, group.currency)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
