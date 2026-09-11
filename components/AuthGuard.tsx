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
        <div>
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-red-600 font-semibold">Access denied.</p>
          <p className="text-gray-500 text-sm mt-1">
            Your account ({user.email}) is not authorised.
            Contact the administrator.
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null; // redirecting

  return <>{children}</>;
}
