'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation.js';
import { Home, Mountain, CloudSun, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase/client';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [userId, setUserId] = React.useState<string | null>(null);

  // Check auth state
  React.useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: authSub } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
        setUserId(session?.user?.id ?? null);
      });
      unsub = () => authSub.subscription.unsubscribe();
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  const navItems = [
    {
      href: '/',
      icon: Home,
      label: 'Home',
      match: (path: string) => path === '/',
    },
    {
      href: '/activities',
      icon: Mountain,
      label: 'Activities',
      match: (path: string) => path.startsWith('/activities'),
    },
    {
      href: '/weather',
      icon: CloudSun,
      label: 'Weather',
      match: (path: string) => path.startsWith('/weather'),
    },
    {
      href: userId ? '/settings' : '/login',
      icon: Settings,
      label: 'Settings',
      match: (path: string) => path.startsWith('/settings') || path.startsWith('/login'),
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 h-16 flex items-center justify-around px-2 safe-area-inset-bottom"
      role="navigation"
      aria-label="Main navigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname ? item.match(pathname) : false;

        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            style={{
              color: isActive ? '#0e7490' : '#374151',
            }}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors hover:opacity-80"
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={24} strokeWidth={2} aria-hidden="true" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
