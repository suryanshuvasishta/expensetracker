import { useStore } from '../../store';
import { Header } from '../Layout/Header';
import { StatCard } from './StatCard';
import { CategoryChart } from './CategoryChart';
import { PaymentMethodChart } from './PaymentMethodChart';
import { TrendChart } from './TrendChart';
import { TopMerchants } from './TopMerchants';
import { ArrowDownRight, ArrowUpRight, Activity, CreditCard } from 'lucide-react';

export function Dashboard() {
  const { transactions, categories, selectedMonth } = useStore();

  const monthTxns = transactions.filter(t => t.month === selectedMonth);
  const allTxns = transactions;

  const totalDebit = monthTxns
    .filter(t => t.type === 'debit' && !t.isCorrelationPair)
    .reduce((s, t) => s + t.amount, 0);

  const totalCredit = monthTxns
    .filter(t => t.type === 'credit')
    .reduce((s, t) => s + t.amount, 0);

  const netFlow = totalCredit - totalDebit;

  const ccSpend = monthTxns
    .filter(t => t.type === 'debit' && ['Axis Credit Card', 'SBI Credit Card', 'ICICI Credit Card'].includes(t.account))
    .reduce((s, t) => s + t.amount, 0);

  const fmt = (n: number) => `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <Header title="Dashboard" />
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1400px' }}>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <StatCard
            title="Total Expenses"
            value={fmt(totalDebit)}
            subtitle={`${monthTxns.filter(t => t.type === 'debit' && !t.isCorrelationPair).length} transactions`}
            color="#f87171"
            icon={<ArrowDownRight size={18} />}
          />
          <StatCard
            title="Total Income"
            value={fmt(totalCredit)}
            subtitle={`${monthTxns.filter(t => t.type === 'credit').length} transactions`}
            color="#4ade80"
            icon={<ArrowUpRight size={18} />}
          />
          <StatCard
            title="Net Flow"
            value={`${netFlow >= 0 ? '+' : '-'}${fmt(netFlow)}`}
            subtitle={netFlow >= 0 ? 'Surplus' : 'Deficit'}
            color={netFlow >= 0 ? '#4ade80' : '#f87171'}
            icon={<Activity size={18} />}
          />
          <StatCard
            title="Credit Card Spend"
            value={fmt(ccSpend)}
            subtitle="Axis + SBI + ICICI CC"
            color="#c084fc"
            icon={<CreditCard size={18} />}
          />
        </div>

        {/* Trend Chart (full width) */}
        <TrendChart transactions={allTxns} />

        {/* Category + Payment Method */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <CategoryChart transactions={monthTxns} categories={categories} />
          <PaymentMethodChart transactions={monthTxns} />
        </div>

        {/* Top Merchants */}
        <TopMerchants transactions={monthTxns} />

      </div>
    </div>
  );
}
