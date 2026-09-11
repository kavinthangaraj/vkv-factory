'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/firebase';
import { ALLOWED_EMAILS } from '@/lib/constants';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  isAuthorized: boolean;
  sendOTP: (email: string) => Promise<{ error: string | null }>;
  verifyOTP: (email: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  isAuthorized: false,
  sendOTP: async () => ({ error: null }),
  verifyOTP: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const sendOTP = async (email: string): Promise<{ error: string | null }> => {
    const trimmed = email.trim().toLowerCase();

    // Block unauthorised emails before even sending OTP
    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(trimmed)) {
      return { error: 'This email is not authorised to access this system.' };
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });

    return { error: error?.message ?? null };
  };

  const verifyOTP = async (email: string, token: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email',
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAuthorized =
    user !== null &&
    (ALLOWED_EMAILS.length === 0 ||
      ALLOWED_EMAILS.map(e => e.toLowerCase()).includes((user.email ?? '').toLowerCase()));

  return (
    <AuthContext.Provider value={{ user, loading, isAuthorized, sendOTP, verifyOTP, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
