'use client';

import { Nav } from '@/components/nav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function AuditPage() {
  const { data } = useQuery({ queryKey: ['audit'], queryFn: () => api('/audit') });

  return (
    <main>
      <Nav />
      <div className="p-6">
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-2">Audit Log</h2>
          {(data || []).map((row: any) => (
            <div key={row.id} className="text-sm border-b py-2">
              {row.createdAt} | {row.action} | {row.resource}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}