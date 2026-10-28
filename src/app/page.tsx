'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { getAppwriteClient, APPWRITE_CONFIG } from '@/lib/appwrite/client';
import { Query } from 'appwrite';
import { GroupRow, MemberRow } from '@/types';
import Link from 'next/link';
import {
  Plus,
  Users,
  KeyRound,
  ArrowRight,
  Loader2,
  Receipt,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  X,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, loading: authLoading, getJWT } = useAuth();
  const router = useRouter();

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  // Form states
  const [groupName, setGroupName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [inviteCode, setInviteCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Protected route guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const loadUserGroups = useCallback(async () => {
    if (!user) return;
    setLoadingGroups(true);
    try {
      const { tablesDB } = getAppwriteClient();
      // Query members where userId == current user, and select related group.*
      const memberRows = await tablesDB.listRows<MemberRow>({
        databaseId: APPWRITE_CONFIG.databaseId,
        tableId: APPWRITE_CONFIG.tables.members,
        queries: [
          Query.equal('userId', [user.$id]),
          Query.select(['*', 'group.*']),
        ],
      });

      const extractedGroups: GroupRow[] = [];
      for (const m of memberRows.rows) {
        if (m.group && typeof m.group === 'object') {
          extractedGroups.push(m.group as GroupRow);
        }
      }

      setGroups(extractedGroups);
    } catch (err: any) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadUserGroups();
    }
  }, [user, loadUserGroups]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setActionLoading(true);

    try {
      const jwt = await getJWT();
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ name: groupName.trim(), currency }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Server error (${res.status}): Failed to create group`);
      }

      setCreateModalOpen(false);
      setGroupName('');
      await loadUserGroups();
      router.push(`/groups/${data.group.$id}`);
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || 'Error creating group');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setActionLoading(true);

    try {
      const jwt = await getJWT();
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ inviteCode: inviteCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Server error (${res.status}): Failed to join group`);
      }

      setJoinModalOpen(false);
      setInviteCode('');
      await loadUserGroups();
      router.push(`/groups/${data.group.$id}`);
    } catch (err: any) {
      console.error(err);
      setJoinError(err.message || 'Error joining group');
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome & Action Bar */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Welcome back, {user?.name || user?.email.split('@')[0]}!
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage your shared household expenses and trip balances.
            </p>
          </div>

          <div className="mt-4 sm:mt-0 flex flex-wrap gap-2.5">
            <button
              onClick={() => {
                setJoinError(null);
                setJoinModalOpen(true);
              }}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 active:scale-[0.99] shadow-xs transition-all cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-slate-500" />
              <span>Join with Code</span>
            </button>

            <button
              onClick={() => {
                setCreateError(null);
                setCreateModalOpen(true);
              }}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 border border-transparent rounded-xl text-sm font-semibold text-white hover:bg-emerald-700 active:scale-[0.99] shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Group</span>
            </button>
          </div>
        </div>

        {/* Groups Grid / Empty State */}
        {loadingGroups ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs animate-pulse space-y-4"
              >
                <div className="h-5 bg-slate-200 rounded-md w-3/4"></div>
                <div className="h-4 bg-slate-100 rounded-md w-1/2"></div>
                <div className="h-10 bg-slate-50 rounded-xl w-full mt-4"></div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center max-w-xl mx-auto shadow-xs my-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No groups yet</h3>
            <p className="text-sm text-slate-600 mb-6">
              Create a group for your apartment roommates or a weekend trip, or enter an invite code to join an existing group.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Group</span>
              </button>
              <button
                onClick={() => setJoinModalOpen(true)}
                className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors"
              >
                <KeyRound className="w-4 h-4" />
                <span>Enter Invite Code</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <Link
                key={group.$id}
                href={`/groups/${group.$id}`}
                className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base group-hover:scale-105 transition-transform">
                      {group.name[0]?.toUpperCase() || 'G'}
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {group.currency}
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                    {group.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Invite Code:{' '}
                    <span className="font-mono font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md">
                      {group.inviteCode}
                    </span>
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-medium text-emerald-600 group-hover:translate-x-1 transition-transform">
                  <span>Open Ledger & Settle Up</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Feature Highlights Banner */}
        <div className="mt-14 bg-gradient-to-r from-emerald-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
          <div className="sm:flex sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Appwrite TablesDB Architecture</span>
              </span>
              <h2 className="text-xl sm:text-2xl font-bold">
                Atomic Ledger Transactions & Row-Level Security
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Every expense and its participant splits are committed atomically via TablesDB transactions.
                All data is sealed to your Appwrite Team with zero floating-point math drift.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Modal: Create Group */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">Create New Group</h3>
            <p className="text-xs text-slate-500 mb-5">
              Creates a group ledger and an isolated Appwrite Team for row permissions.
            </p>

            {createError && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Flat 402 or Trip to Tokyo"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center space-x-1.5 shadow-xs"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Create Group</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Join Group */}
      {joinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => setJoinModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">Join Group with Invite Code</h3>
            <p className="text-xs text-slate-500 mb-5">
              Enter the unique invite code provided by your roommate or friend.
            </p>

            {joinError && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoinGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Invite Code
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. INV_ABC123"
                  className="w-full font-mono uppercase px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setJoinModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center space-x-1.5 shadow-xs"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Join Group</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
