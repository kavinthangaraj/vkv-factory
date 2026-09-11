'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

type Stage = 'email' | 'otp';

export default function LoginPage() {
  const { user, loading, sendOTP, verifyOTP } = useAuth();
  const router = useRouter();

  const [stage, setStage]   = useState<Stage>('email');
  const [email, setEmail]   = useState('');
  const [otp, setOtp]       = useState('');
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');
  const [info, setInfo]     = useState('');

  useEffect(() => {
    if (!loading && user) router.push('/');
  }, [user, loading, router]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    const { error: err } = await sendOTP(email);
    if (err) {
      setError(err);
    } else {
      setStage('otp');
      setInfo(`A 6-digit code was sent to ${email}. Check your inbox.`);
    }
    setBusy(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    const { error: err } = await verifyOTP(email, otp);
    if (err) {
      setError('Invalid or expired code. Please try again.');
    }
    // On success, onAuthStateChange fires → user is set → useEffect redirects
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-2">🏭</div>
          <h1 className="text-2xl font-bold text-gray-800">VKV Factory</h1>
          <p className="text-gray-500 text-sm mt-1">Management System</p>
        </div>

        {stage === 'email' ? (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Gmail address
              </label>
              <input
                required
                type="email"
                autoFocus
                placeholder="kavinrajt@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send Login Code →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            {info && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
                {info}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                6-digit code
              </label>
              <input
                required
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || otp.length < 6}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
            >
              {busy ? 'Verifying…' : 'Verify & Sign In'}
            </button>

            <button
              type="button"
              onClick={() => { setStage('email'); setOtp(''); setError(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Use a different email
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Only authorised emails can access this system.
        </p>
      </div>
    </div>
  );
}
