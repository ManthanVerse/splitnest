'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import {
  Database,
  Shield,
  Zap,
  GitBranch,
  Layers,
  ArrowLeft,
  Key,
  CheckCircle2,
  Lock,
  Search,
  Scale,
  RefreshCw,
} from 'lucide-react';

export default function UnderTheHoodPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Navigation */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-xl mb-10 border border-emerald-900/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-4">
              <Zap className="w-3.5 h-3.5" />
              <span>Appwrite Databases Hackathon Architecture</span>
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Under the Hood: How SplitNest Leverages Appwrite TablesDB
            </h1>
            <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
              SplitNest was architected from the ground up to deliberately showcase the power, precision, and security of Appwrite TablesDB. Here is an exhaustive breakdown of the technical decisions powering every feature.
            </p>
          </div>
        </div>

        {/* 6 Core Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Pillar 1: Typed Columns & Integer Currency */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:border-emerald-200 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <Scale className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              1. Typed Columns & Integer Minor Units
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Floating-point numbers in financial applications lead to IEEE 754 precision bugs (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">0.1 + 0.2 !== 0.3</code>). SplitNest stores all currency values as strictly typed <strong>Integer</strong> columns (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">amountMinor</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">shareMinor</code>) representing cents or paise.
            </p>
            <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
              <li><strong>Integer:</strong> <code className="text-emerald-700">amountMinor</code>, <code className="text-emerald-700">shareMinor</code></li>
              <li><strong>Varchar:</strong> <code className="text-emerald-700">name</code>, <code className="text-emerald-700">inviteCode</code>, <code className="text-emerald-700">description</code></li>
              <li><strong>Datetime:</strong> <code className="text-emerald-700">expenseDate</code>, <code className="text-emerald-700">settledAt</code></li>
              <li><strong>Enums:</strong> <code className="text-emerald-700">category</code>, <code className="text-emerald-700">splitType</code></li>
            </ul>
          </div>

          {/* Pillar 2: Native Relational Integrity */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:border-emerald-200 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <GitBranch className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              2. Real Relationships & Cascade / Restrict Mutate
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Instead of denormalized flat tables, SplitNest leverages Appwrite TablesDB first-class relational integrity with two-way relations:
            </p>
            <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
              <li>
                <strong>ManyToOne (<code className="text-blue-700">splits.expense</code>):</strong> Cascade delete. Deleting an expense automatically removes all its participant share records.
              </li>
              <li>
                <strong>ManyToOne (<code className="text-blue-700">expenses.paidBy</code>):</strong> Restrict mutate. Prevents accidental deletion of a member who has paid active expenses.
              </li>
              <li>
                <strong>ManyToOne (<code className="text-blue-700">settlements.group</code>):</strong> Cascade delete on group removal.
              </li>
            </ul>
          </div>

          {/* Pillar 3: Multi-Row Atomic Transactions */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:border-emerald-200 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mb-4">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              3. Atomic Transactions with Rollback
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Recording an expense with unequal or custom splits involves writing 1 expense row and N split rows. A network drop halfway through must never leave orphaned debts.
            </p>
            <div className="bg-slate-900 text-slate-200 p-3 rounded-xl text-[11px] font-mono leading-relaxed overflow-x-auto">
              <span className="text-purple-400">const</span> tx = <span className="text-purple-400">await</span> tablesDB.createTransaction(...);<br />
              <span className="text-slate-400">// Stage expense + participant splits in transaction</span><br />
              <span className="text-purple-400">await</span> tx.createRow(&apos;expenses&apos;, ...);<br />
              <span className="text-purple-400">await</span> tx.createRow(&apos;splits&apos;, ...);<br />
              <span className="text-purple-400">await</span> tablesDB.commitTransaction(&#123; transactionId: tx.$id &#125;);
            </div>
          </div>

          {/* Pillar 4: Row-Level Security via Appwrite Teams */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:border-emerald-200 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              4. Row-Level Security with Role.team
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Every table has <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">rowSecurity: true</code>. When a group is created, an Appwrite Team is generated. Every row in that group receives permissions strictly for that team:
            </p>
            <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
              <li><code className="text-rose-700">Permission.read(Role.team(teamId))</code></li>
              <li><code className="text-rose-700">Permission.update(Role.team(teamId))</code></li>
              <li><code className="text-rose-700">Permission.delete(Role.team(teamId))</code></li>
              <li>No row is ever exposed to <code className="text-slate-500">Role.any()</code>. Unauthorized users cannot query another group&apos;s data.</li>
            </ul>
          </div>

          {/* Pillar 5: Specialized Indexes & Queries */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:border-emerald-200 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              5. Specialized Indexes & Query Operators
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              To support lightning-fast filtering, sorting, and fulltext search directly inside TablesDB without client-side data dumping:
            </p>
            <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
              <li><strong>Fulltext Index:</strong> <code className="text-amber-700">idx_expenses_description_search</code> powers <code className="text-slate-800">Query.search(&apos;description&apos;, term)</code>.</li>
              <li><strong>Key Index:</strong> <code className="text-amber-700">idx_expenses_amount</code> powers min/max amount filtering and magnitude sorting.</li>
              <li><strong>Key Index:</strong> <code className="text-amber-700">idx_expenses_category</code> powers instant category categorization.</li>
              <li><strong>Unique Index:</strong> <code className="text-amber-700">idx_groups_inviteCode</code> guarantees O(1) group invitations.</li>
            </ul>
          </div>

          {/* Pillar 6: Realtime Subscriptions & Polling Fallback */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:border-emerald-200 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center mb-4">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              6. Appwrite Realtime Channel Listeners
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Live updates are streamed to roommates using Appwrite Realtime table row channels:
            </p>
            <div className="bg-slate-900 text-slate-200 p-3 rounded-xl text-[11px] font-mono leading-relaxed overflow-x-auto">
              Channel.tablesdb(&apos;splitnest&apos;).table(&apos;expenses&apos;).row()<br />
              Channel.tablesdb(&apos;splitnest&apos;).table(&apos;settlements&apos;).row()
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              When any roommate logs an expense or completes a settlement, all screens refresh automatically without reloading.
            </p>
          </div>
        </div>

        {/* Database Schema Summary Table */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs mb-10">
          <div className="flex items-center space-x-2 mb-4">
            <Database className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">
              TablesDB Schema Overview (Database ID: <code className="font-mono text-emerald-700">splitnest</code>)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-2.5 px-3 font-bold text-slate-700">Table</th>
                  <th className="py-2.5 px-3 font-bold text-slate-700">Typed Columns</th>
                  <th className="py-2.5 px-3 font-bold text-slate-700">Relationship Foreign Keys</th>
                  <th className="py-2.5 px-3 font-bold text-slate-700">Indexes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 font-mono">
                <tr>
                  <td className="py-3 px-3 font-bold text-slate-900">groups</td>
                  <td className="py-3 px-3">name (varchar), currency (varchar), inviteCode (varchar), teamId (varchar), createdBy (varchar)</td>
                  <td className="py-3 px-3 text-slate-400">None (Root entity)</td>
                  <td className="py-3 px-3 text-emerald-700">idx_groups_inviteCode (Unique)</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-bold text-slate-900">members</td>
                  <td className="py-3 px-3">displayName (varchar), userId (varchar)</td>
                  <td className="py-3 px-3">group -&gt; groups (Cascade)</td>
                  <td className="py-3 px-3 text-emerald-700">idx_members_userId (Key)</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-bold text-slate-900">expenses</td>
                  <td className="py-3 px-3">description (varchar), amountMinor (integer), category (enum), expenseDate (datetime), splitType (enum)</td>
                  <td className="py-3 px-3">group -&gt; groups (Cascade)<br />paidBy -&gt; members (Restrict)</td>
                  <td className="py-3 px-3 text-emerald-700">idx_expenses_description_search (Fulltext)<br />idx_expenses_amount (Key)<br />idx_expenses_category (Key)<br />idx_expenses_expenseDate (Key)</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-bold text-slate-900">splits</td>
                  <td className="py-3 px-3">shareMinor (integer)</td>
                  <td className="py-3 px-3">expense -&gt; expenses (Cascade)<br />member -&gt; members (Restrict)</td>
                  <td className="py-3 px-3 text-slate-400">Inherited from parent relations</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-bold text-slate-900">settlements</td>
                  <td className="py-3 px-3">amountMinor (integer), settledAt (datetime)</td>
                  <td className="py-3 px-3">group -&gt; groups (Cascade)<br />fromMember -&gt; members (Restrict)<br />toMember -&gt; members (Restrict)</td>
                  <td className="py-3 px-3 text-emerald-700">idx_settlements_settledAt (Key)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
