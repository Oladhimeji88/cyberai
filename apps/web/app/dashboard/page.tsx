'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Nav } from '@/components/nav';
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function DashboardPage() {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: () => api('/dashboard') });

  const chart = [
    { name: 'Findings', value: data?.findings || 0 },
    { name: 'Open Alerts', value: data?.openAlerts || 0 },
    { name: 'Score', value: data?.postureScore || 0 },
  ];

  return (
    <main>
      <Nav />
      <div className="p-6 grid md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">Posture Score: <strong>{data?.postureScore ?? '-'}</strong></div>
        <div className="bg-white p-4 rounded shadow">Open Findings: <strong>{data?.findings ?? '-'}</strong></div>
        <div className="bg-white p-4 rounded shadow">Open Alerts: <strong>{data?.openAlerts ?? '-'}</strong></div>
      </div>
      <div className="p-6 bg-white m-6 rounded shadow overflow-auto">
        <BarChart width={480} height={280} data={chart}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#0ea5e9" />
        </BarChart>
      </div>
    </main>
  );
}