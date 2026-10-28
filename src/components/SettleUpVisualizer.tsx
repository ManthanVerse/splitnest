'use client';

import React from 'react';
import { SettlementPayment, formatCurrency } from '@/lib/split-engine';
import { MemberRow } from '@/types';
import { Sparkles, ArrowRight, TrendingDown, CheckCircle2 } from 'lucide-react';

interface SettleUpVisualizerProps {
  payments: SettlementPayment[];
  members: MemberRow[];
  currency: string;
  naiveCount: number;
}

export function SettleUpVisualizer({
  payments,
  members,
  currency,
  naiveCount,
}: SettleUpVisualizerProps) {
  const minimalCount = payments.length;
  const reductionPercent =
    naiveCount > 0 ? Math.round(((naiveCount - minimalCount) / naiveCount) * 100) : 0;

  const getMemberName = (id: string) => {
    return members.find((m) => m.$id === id)?.displayName || 'Roommate';
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
      {/* Before / After Metrics Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Naive Repayments
          </span>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-700">{naiveCount}</span>
            <span className="text-xs text-slate-500">separate transfers</span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            If each person repaid every receipt individually.
          </p>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
            SplitNest Minimal
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Minimal Payments Plan
          </span>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-emerald-700">{minimalCount}</span>
            <span className="text-xs text-emerald-700 font-medium">optimized transfers</span>
          </div>
          <p className="mt-1.5 text-[11px] text-emerald-800">
            Greedy bipartite matching clears all debt with minimal transactions.
          </p>
        </div>

        <div className="bg-teal-50/60 border border-teal-200 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-800">
              Transfer Reduction
            </span>
            <div className="mt-1 flex items-baseline space-x-1.5">
              <span className="text-3xl font-extrabold text-teal-700">
                {reductionPercent > 0 ? `-${reductionPercent}%` : '0%'}
              </span>
              <TrendingDown className="w-5 h-5 text-teal-600" />
            </div>
          </div>
          <p className="text-[11px] text-teal-800 mt-1">
            {reductionPercent > 0
              ? `Eliminated ${naiveCount - minimalCount} unnecessary circular transfers!`
              : 'Ledger is optimized.'}
          </p>
        </div>
      </div>

      {/* Visual Debt Flow Diagram (Pure SVG + HTML) */}
      {payments.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center space-x-2 mb-4">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Visual Debt Clearance Flow
            </h4>
          </div>

          <div className="space-y-3">
            {payments.map((p, idx) => {
              const fromName = getMemberName(p.fromMemberId);
              const toName = getMemberName(p.toMemberId);

              return (
                <div
                  key={idx}
                  className="bg-gradient-to-r from-slate-50 via-emerald-50/30 to-teal-50/40 border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs transition-all hover:border-emerald-300"
                >
                  {/* Debtor */}
                  <div className="flex items-center space-x-3 w-1/3">
                    <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center font-bold text-xs shrink-0">
                      {fromName[0]?.toUpperCase()}
                    </div>
                    <div className="truncate">
                      <span className="text-xs font-bold text-slate-800 truncate block">
                        {fromName}
                      </span>
                      <span className="text-[10px] text-rose-600 font-semibold uppercase tracking-wider">
                        Debtor
                      </span>
                    </div>
                  </div>

                  {/* Flow Arrow & Amount */}
                  <div className="flex-1 flex flex-col items-center px-4">
                    <div className="px-3 py-1 rounded-full bg-white border border-emerald-200 shadow-xs text-xs font-extrabold text-emerald-800 mb-1">
                      {formatCurrency(p.amountMinor, currency)}
                    </div>
                    <div className="w-full flex items-center space-x-1">
                      <div className="h-0.5 bg-gradient-to-r from-rose-300 via-emerald-400 to-emerald-500 flex-1"></div>
                      <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0 -ml-1" />
                    </div>
                  </div>

                  {/* Creditor */}
                  <div className="flex items-center space-x-3 w-1/3 justify-end text-right">
                    <div className="truncate">
                      <span className="text-xs font-bold text-slate-800 truncate block">
                        {toName}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">
                        Creditor
                      </span>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-xs shrink-0">
                      {toName[0]?.toUpperCase()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
