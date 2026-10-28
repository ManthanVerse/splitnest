'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { RefreshCw, Home, AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-red-200 shadow-xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertCircle className="w-8 h-8" />
          </div>

          <span className="text-xs font-bold uppercase tracking-wider text-red-600">
            Application Error
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1 mb-2">
            Something went wrong
          </h1>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            {error.message || 'An unexpected error occurred while communicating with Appwrite services.'}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>

            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Back Home</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
