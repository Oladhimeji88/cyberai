'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  ['/dashboard', 'Dashboard'],
  ['/cnapp', 'CNAPP'],
  ['/alerts', 'Alerts'],
  ['/pam', 'PAM'],
  ['/secrets', 'Secrets'],
  ['/settings', 'Settings'],
  ['/audit', 'Audit'],
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="bg-ink text-white px-4 py-3 flex gap-3 overflow-x-auto">
      {items.map(([href, label]) => (
        <Link key={href} href={href} className={`px-3 py-1 rounded ${pathname === href ? 'bg-signal text-black' : 'bg-slate-700'}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}