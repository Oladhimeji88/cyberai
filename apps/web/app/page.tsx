'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@democorp.test');
  const [password, setPassword] = useState('Password123!');
  const [orgName, setOrgName] = useState('DemoCorp');
  const [mfaCode, setMfaCode] = useState('');
  const [message, setMessage] = useState('');

  async function login() {
    const res = await fetch('http://localhost:4000/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, orgName, mfaCode: mfaCode || undefined }),
    });
    const body = await res.json();
    if (body.accessToken) {
      localStorage.setItem('token', body.accessToken);
      window.location.href = '/dashboard';
      return;
    }
    if (body.mustSetupMfa) {
      localStorage.setItem('token', body.accessToken);
      setMessage('MFA setup required. Go to Settings to configure TOTP, then login again with code.');
      window.location.href = '/settings';
      return;
    }
    setMessage(JSON.stringify(body));
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-white to-amber-100 p-4">
      <div className="bg-white shadow-xl rounded-xl p-6 w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-4">SentinelOne MVP Login</h1>
        <input className="w-full p-2 border rounded mb-2" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Org" />
        <input className="w-full p-2 border rounded mb-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="w-full p-2 border rounded mb-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <input className="w-full p-2 border rounded mb-4" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="MFA code (if enabled)" />
        <button className="w-full bg-signal text-black p-2 rounded" onClick={login}>Login</button>
        <p className="mt-3 text-sm text-slate-700">{message}</p>
      </div>
    </main>
  );
}
