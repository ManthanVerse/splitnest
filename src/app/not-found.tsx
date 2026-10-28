'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Home, ArrowLeft, AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-100">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            404 Error
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1 mb-2">
            Page Not Found
          </h1>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            The group, expense, or route you are looking for does not exist or has been relocated.
          </p>

          <Link
            href="/"
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
