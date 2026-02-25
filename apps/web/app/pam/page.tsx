'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Nav } from '@/components/nav';
import { useState } from 'react';

export default function PamPage() {
  const q = useQueryClient();
  const { data: targets } = useQuery({ queryKey: ['targets'], queryFn: () => api('/pam/targets') });
  const { data: requests } = useQuery({ queryKey: ['pamRequests'], queryFn: () => api('/pam/requests') });
  const { data: sessions } = useQuery({ queryKey: ['sessions'], queryFn: () => api('/pam/sessions/active') });

  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('Need prod debug');

  async function requestAccess() {
    await api('/pam/requests', { method: 'POST', body: JSON.stringify({ targetId, reason, requestedUntil: new Date(Date.now() + 3600_000).toISOString() }) });
    q.invalidateQueries({ queryKey: ['pamRequests'] });
  }

  async function approve(id: string) {
    await api(`/pam/requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ reason: 'Approved', windowEnd: new Date(Date.now() + 3600_000).toISOString() }) });
    q.invalidateQueries({ queryKey: ['pamRequests'] });
  }

  async function start(id: string) {
    await api(`/pam/requests/${id}/start`, { method: 'POST' });
    q.invalidateQueries({ queryKey: ['sessions'] });
  }

  return (
    <main>
      <Nav />
      <div className="p-6 space-y-4">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">Request JIT Access</h2>
          <select className="border p-2 mr-2" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">Select target</option>
            {(targets || []).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input className="border p-2 mr-2" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="bg-signal p-2 rounded" onClick={requestAccess}>Submit</button>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold">Requests</h2>
          {(requests || []).map((r: any) => (
            <div key={r.id} className="border-b py-2 flex gap-2 items-center">
              <span>{r.target?.name} - {r.status}</span>
              <button className="bg-amber-200 px-2 rounded" onClick={() => approve(r.id)}>Approve</button>
              <button className="bg-emerald-200 px-2 rounded" onClick={() => start(r.id)}>Start Session</button>
            </div>
          ))}
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold">Active Sessions</h2>
          {(sessions || []).map((s: any) => <div key={s.id}>{s.id} / {s.startedAt}</div>)}
        </div>
      </div>
    </main>
  );
}