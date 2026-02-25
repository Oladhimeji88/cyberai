'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Nav } from '@/components/nav';

export default function SecretsPage() {
  const q = useQueryClient();
  const { data } = useQuery({ queryKey: ['secrets'], queryFn: () => api('/secrets') });
  const [name, setName] = useState('new_secret');
  const [value, setValue] = useState('value123');

  async function createSecret() {
    await api('/secrets', { method: 'POST', body: JSON.stringify({ name, value, description: 'created in UI' }) });
    q.invalidateQueries({ queryKey: ['secrets'] });
  }

  async function rotate(id: string) {
    await api(`/secrets/${id}/rotate`, { method: 'POST', body: JSON.stringify({}) });
    q.invalidateQueries({ queryKey: ['secrets'] });
  }

  return (
    <main>
      <Nav />
      <div className="p-6 space-y-4">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">Create Secret</h2>
          <input className="border p-2 mr-2" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="border p-2 mr-2" value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="bg-signal p-2 rounded" onClick={createSecret}>Create</button>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold">Secrets</h2>
          {(data || []).map((s: any) => (
            <div key={s.id} className="border-b py-2 flex justify-between">
              <span>{s.name} (versions: {s.versions?.length || 0})</span>
              <button className="bg-amber-200 px-2 rounded" onClick={() => rotate(s.id)}>Rotate now</button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}