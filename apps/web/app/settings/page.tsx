'use client';

import { Nav } from '@/components/nav';
import { api } from '@/lib/api';
import { useState } from 'react';

export default function SettingsPage() {
  const [token, setToken] = useState('');
  const [mfa, setMfa] = useState<any>(null);
  const [apiToken, setApiToken] = useState('');

  async function setupMfa() {
    const res = await api('/auth/mfa/setup', { method: 'POST' });
    setMfa(res);
  }

  async function enableMfa() {
    await api('/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ token }) });
    alert('MFA enabled');
  }

  async function createApiToken() {
    const res = await api('/api-tokens', { method: 'POST', body: JSON.stringify({ name: 'ui-token' }) });
    setApiToken(res.token);
  }

  async function createWebhook() {
    await api('/webhooks', { method: 'POST', body: JSON.stringify({ name: 'demo', url: 'http://host.docker.internal:9999/webhook', secret: 'demo-secret' }) });
    alert('Webhook saved');
  }

  return (
    <main>
      <Nav />
      <div className="p-6 space-y-4">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold">MFA Setup</h2>
          <button className="bg-signal p-2 rounded mr-2" onClick={setupMfa}>Generate TOTP Secret</button>
          {mfa ? <pre className="text-xs mt-2">{JSON.stringify(mfa, null, 2)}</pre> : null}
          <div className="mt-2">
            <input className="border p-2 mr-2" placeholder="TOTP token" value={token} onChange={(e) => setToken(e.target.value)} />
            <button className="bg-emerald-300 p-2 rounded" onClick={enableMfa}>Enable</button>
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold">API Tokens</h2>
          <button className="bg-signal p-2 rounded" onClick={createApiToken}>Create API token</button>
          {apiToken ? <div className="mt-2 text-sm">Token: {apiToken}</div> : null}
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold">Webhooks</h2>
          <button className="bg-signal p-2 rounded" onClick={createWebhook}>Create default webhook</button>
        </div>
      </div>
    </main>
  );
}