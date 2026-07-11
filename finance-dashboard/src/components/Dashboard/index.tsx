import { useStore } from '../../store';
import { Header } from '../Layout/Header';
import { StatCard } from './StatCard';
import { CategoryChart } from './CategoryChart';
import { PaymentMethodChart } from './PaymentMethodChart';
import { CashFlowChart } from './CashFlowChart';
import { TopMerchants } from './TopMerchants';
import { NetWorthCard } from './NetWorthCard';
import { filterTxns, totalSpend, totalIncome, ccSpend, spendTxns, incomeTxns, momDelta } from '../../services/selectors';
import { ArrowDownRight, ArrowUpRight, PiggyBank, CreditCard } from 'lucide-react';

export function Dashboard() {
  const { transactions, categories, selectedMonth, selectedOwner, investments, liabilities } = useStore();

  const monthTxns = filterTxns(transactions, { month: selectedMonth, owner: selectedOwner });

  const income = totalIncome(monthTxns);
  const spend = totalSpend(monthTxns);
  const savings = income - spend;
  const savingsRate = income > 0 ? (savings / income) * 100 : null;
  const cc = ccSpend(monthTxns);

  const incomeTrend = momDelta(transactions, selectedMonth, selectedOwner, totalIncome);
  const spendTrend = momDelta(transactions, selectedMonth, selectedOwner, totalSpend);
  const ccTrend = momDelta(transactions, selectedMonth, selectedOwner, ccSpend);

  const fmt = (n: number) => `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <Header title="Dashboard" />
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1400px' }}>

        {/* Row 1 — the month at a glance */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <StatCard
            title="Income"
            value={fmt(income)}
            subtitle={`${incomeTxns(monthTxns).length} credits`}
            trend={incomeTrend}
            goodDirection="up"
            color="#4ade80"
            icon={<ArrowUpRight size={18} />}
          />
          <StatCard
            title="Expenses"
            value={fmt(spend)}
            subtitle={`${spendTxns(monthTxns).length} transactions`}
            trend={spendTrend}
            goodDirection="down"
            color="#f87171"
            icon={<ArrowDownRight size={18} />}
          />
          <StatCard
            title="Savings"
            value={`${savings >= 0 ? '+' : '-'}${fmt(savings)}`}
            subtitle={savingsRate !== null ? `${savingsRate.toFixed(0)}% of income saved` : 'No income recorded'}
            color={savings >= 0 ? '#4ade80' : '#f87171'}
            icon={<PiggyBank size={18} />}
          />
          <StatCard
            title="Credit Card Spend"
            value={fmt(cc)}
            subtitle={spend > 0 ? `${((cc / spend) * 100).toFixed(0)}% of expenses` : undefined}
            trend={ccTrend}
            goodDirection="down"
            color="#c084fc"
            icon={<CreditCard size={18} />}
          />
        </div>

        {/* Row 2 — cash flow hero */}
        <CashFlowChart transactions={transactions} endMonth={selectedMonth} owner={selectedOwner} />

        {/* Row 3 — where money goes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <CategoryChart transactions={monthTxns} categories={categories} />
          <TopMerchants transactions={monthTxns} />
        </div>

        {/* Row 4 — how it's paid + net worth */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <PaymentMethodChart transactions={monthTxns} />
          <NetWorthCard investments={investments} liabilities={liabilities} selectedOwner={selectedOwner} />
        </div>

      </div>
    </div>
  );
}
