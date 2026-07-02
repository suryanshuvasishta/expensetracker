import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number | null;
  goodDirection?: 'up' | 'down'; // whether an increase is good (income) or bad (spend)
  color?: string;
  icon?: React.ReactNode;
}

export function StatCard({ title, value, subtitle, trend, goodDirection = 'down', color = '#3b82f6', icon }: Props) {
  const trendIsGood = trend !== undefined && trend !== null
    ? (goodDirection === 'up' ? trend >= 0 : trend < 0)
    : false;
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 500 }}>{title}</span>
        {icon && <span style={{ color }}>{icon}</span>}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color, letterSpacing: '-0.5px' }}>{value}</div>
      {subtitle && (
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{subtitle}</div>
      )}
      {trend !== undefined && trend !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: trendIsGood ? '#4ade80' : '#f87171' }}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(trend).toFixed(1)}% vs last month
        </div>
      )}
    </div>
  );
}
