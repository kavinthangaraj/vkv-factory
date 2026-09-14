'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading, isAuthorized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  if (user && !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-sm">
          <p className="text-3xl mb-2">🔒</p>
          <p className="text-red-600 font-semibold text-lg">Access Denied</p>
          <p className="text-gray-500 text-sm mt-2">
            Your account ({user.email}) is not authorized in NEXT_PUBLIC_ALLOWED_EMAILS or the database allowed_emails table.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-5 inline-block text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Switch Account / Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null; // redirecting

  return <>{children}</>;
}
