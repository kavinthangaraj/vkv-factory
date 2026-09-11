'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

const NAV = [
  { href: '/',           label: '🏠 Dashboard' },
  { href: '/purchase',   label: '📋 Purchases' },
  { href: '/petty-cash', label: '💰 Petty Cash' },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <nav className="bg-blue-700 text-white shadow-md sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Brand + links */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="font-bold text-base whitespace-nowrap mr-2">VKV Factory</span>
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                pathname === href
                  ? 'bg-blue-900'
                  : 'text-blue-100 hover:bg-blue-600'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="ml-3 text-xs text-blue-200 hover:text-white whitespace-nowrap"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
