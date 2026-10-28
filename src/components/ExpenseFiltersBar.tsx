'use client';

import React from 'react';
import { MemberRow, ExpenseCategory } from '@/types';
import {
  Search,
  Filter,
  Download,
  X,
  ArrowUpDown,
  Calendar,
  DollarSign,
  User,
} from 'lucide-react';

export interface FilterState {
  search: string;
  category: string;
  paidByMemberId: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  sortBy: 'newest' | 'oldest' | 'highest' | 'lowest';
}

interface ExpenseFiltersBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  members: MemberRow[];
  currencySymbol: string;
  onExportCSV: () => void;
  isExporting?: boolean;
}

const CATEGORIES: { label: string; value: string }[] = [
  { label: 'All Categories', value: 'all' },
  { label: 'Groceries', value: 'groceries' },
  { label: 'Rent', value: 'rent' },
  { label: 'Utilities', value: 'utilities' },
  { label: 'Food & Dining', value: 'food' },
  { label: 'Travel', value: 'travel' },
  { label: 'Entertainment', value: 'entertainment' },
  { label: 'Other', value: 'other' },
];

export function ExpenseFiltersBar({
  filters,
  onChange,
  members,
  currencySymbol,
  onExportCSV,
  isExporting = false,
}: ExpenseFiltersBarProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const hasActiveFilters =
    filters.search ||
    filters.category !== 'all' ||
    filters.paidByMemberId !== 'all' ||
    filters.startDate ||
    filters.endDate ||
    filters.minAmount ||
    filters.maxAmount ||
    filters.sortBy !== 'newest';

  const handleReset = () => {
    onChange({
      search: '',
      category: 'all',
      paidByMemberId: 'all',
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
      sortBy: 'newest',
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
      {/* Top Search & Primary Filters Row */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
        {/* Fulltext Search Input */}
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search description (fulltext)..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
          />
        </div>

        {/* Category & Sorting Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={filters.category}
            onChange={(e) => onChange({ ...filters, category: e.target.value })}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) =>
              onChange({ ...filters, sortBy: e.target.value as any })
            }
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="highest">Sort: Highest Amount</option>
            <option value="lowest">Sort: Lowest Amount</option>
          </select>

          {/* Toggle Advanced Filters */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`p-2 rounded-xl border text-xs font-medium flex items-center space-x-1 cursor-pointer transition-colors ${
              showAdvanced || hasActiveFilters
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>

          {/* Export CSV Button (Feature 3.4) */}
          <button
            type="button"
            onClick={onExportCSV}
            disabled={isExporting}
            title="Export filtered expenses to CSV"
            className="py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center space-x-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleReset}
              title="Reset all filters"
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filter Collapse Panel */}
      {showAdvanced && (
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs animate-in fade-in duration-150">
          {/* Payer Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Paid By
            </label>
            <select
              value={filters.paidByMemberId}
              onChange={(e) => onChange({ ...filters, paidByMemberId: e.target.value })}
              className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Members</option>
              {members.map((m) => (
                <option key={m.$id} value={m.$id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: Start */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
              className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Date Range: End */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
              className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Min & Max Amount */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Amount ({currencySymbol} Min - Max)
            </label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Min"
                value={filters.minAmount}
                onChange={(e) => onChange({ ...filters, minAmount: e.target.value })}
                className="w-1/2 py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Max"
                value={filters.maxAmount}
                onChange={(e) => onChange({ ...filters, maxAmount: e.target.value })}
                className="w-1/2 py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
