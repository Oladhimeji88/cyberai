'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { api } from '@/lib/api';
import { Nav } from '@/components/nav';

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['alerts'], queryFn: () => api('/alerts') });

  useEffect(() => {
    const socket = io('http://localhost:4000');
    socket.on('alert', () => queryClient.invalidateQueries({ queryKey: ['alerts'] }));
    return () => socket.close();
  }, [queryClient]);

  async function respond(id: string, actionType: string) {
    await api(`/alerts/${id}/respond`, { method: 'POST', body: JSON.stringify({ actionType }) });
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
  }

  return (
    <main>
      <Nav />
      <div className="p-6 space-y-3">
        {(data || []).map((a: any) => (
          <div key={a.id} className="bg-white rounded shadow p-4">
            <div className="font-semibold">{a.title} ({a.severity})</div>
            <div className="text-sm text-slate-700">{a.description}</div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => respond(a.id, 'revoke_sessions')} className="px-3 py-1 bg-amber-300 rounded">Revoke Sessions</button>
              <button onClick={() => respond(a.id, 'require_reauth')} className="px-3 py-1 bg-rose-300 rounded">Require Re-auth</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}