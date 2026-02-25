'use client';

import { Nav } from '@/components/nav';
import { api } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export default function CnappPage() {
  const q = useQueryClient();
  const { data } = useQuery({ queryKey: ['findings'], queryFn: () => api('/cnapp/findings') });
  const [roleArn, setRoleArn] = useState('');
  const [externalId, setExternalId] = useState('');

  async function run() {
    await api('/cnapp/scan', { method: 'POST' });
    q.invalidateQueries({ queryKey: ['findings'] });
    q.invalidateQueries({ queryKey: ['dashboard'] });
  }

  async function connectAws() {
    await api('/cnapp/connect', { method: 'POST', body: JSON.stringify({ roleArn, externalId }) });
    alert('AWS role saved for this org');
  }

  return (
    <main>
      <Nav />
      <div className="p-6 space-y-4">
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-2">Connect AWS Account</h2>
          <input className="border p-2 mr-2 w-full md:w-96 mb-2" placeholder="Role ARN" value={roleArn} onChange={(e) => setRoleArn(e.target.value)} />
          <input className="border p-2 mr-2 w-full md:w-96" placeholder="External ID (optional)" value={externalId} onChange={(e) => setExternalId(e.target.value)} />
          <div className="mt-2">
            <button onClick={connectAws} className="bg-emerald-300 p-2 rounded">Save AWS Connection</button>
          </div>
        </div>
        <button onClick={run} className="bg-signal p-2 rounded">Run AWS CSPM scan</button>
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold">Findings</h2>
          {(data || []).map((f: any) => (
            <div key={f.id} className="border-b py-2 text-sm">
              [{f.severity}] {f.title} ({f.resource})
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
