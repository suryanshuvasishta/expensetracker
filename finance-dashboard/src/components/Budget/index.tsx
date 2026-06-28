import { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from '../../store';
import { Header } from '../Layout/Header';
import type { MonthlyBudget, InvestmentLine } from '../../types';
import { CATEGORY_GROUPS } from '../../types';
import { generateId } from '../../parsers/base';

const INVESTMENT_GOALS = ['Retirement', "Children's Fund", 'Home Ownership', 'Emergency', 'Consumer Durables', 'Other'] as const;

function fmt(n: number) {
  if (n === 0) return '—';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function pct(value: number, total: number) {
  if (!total) return '';
  return (value / total * 100).toFixed(1) + '%';
}

function emptyBudget(month: string): MonthlyBudget {
  return {
    id: month,
    month,
    grossSalary: 0,
    tds: 0,
    employerHealthInsurance: 0,
    epf: 0,
    nps: 0,
    professionalTax: 0,
    otherDeductions: 0,
    investments: [
      { id: generateId(), label: 'EPF (Employee + Employer)', amount: 0, goal: 'Retirement' },
      { id: generateId(), label: 'NPS', amount: 0, goal: 'Retirement' },
      { id: generateId(), label: 'SSY', amount: 0, goal: "Children's Fund" },
    ],
    homeLoanEmi: 0,
    otherFixedLiabilities: 0,
    categoryBudgets: {},
  };
}

function NumInput({ value, onChange, style }: { value: number; onChange: (v: number) => void; style?: React.CSSProperties }) {
  const [raw, setRaw] = useState(value === 0 ? '' : String(value));

  useEffect(() => {
    setRaw(value === 0 ? '' : String(value));
  }, [value]);

  return (
    <input
      type="number"
      value={raw}
      onChange={e => { setRaw(e.target.value); onChange(parseFloat(e.target.value) || 0); }}
      placeholder="0"
      style={{ width: '120px', textAlign: 'right', padding: '0.25rem 0.5rem', fontSize: '0.8125rem', ...style }}
    />
  );
}

export function BudgetPage() {
  const { transactions, saveBudget, getBudget, selectedMonth, setSelectedMonth } = useStore();
  const [budget, setBudget] = useState<MonthlyBudget>(() => emptyBudget(selectedMonth));
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  // Load budget when month changes
  useEffect(() => {
    const existing = getBudget(selectedMonth);
    setBudget(existing ? { ...existing } : emptyBudget(selectedMonth));
  }, [selectedMonth]);

  const patch = useCallback(<K extends keyof MonthlyBudget>(key: K, value: MonthlyBudget[K]) => {
    setBudget(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  async function handleSave() {
    await saveBudget(budget);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Derived
  const totalDeductions = budget.employerHealthInsurance + budget.epf + budget.nps + budget.professionalTax + budget.otherDeductions;
  const inHand = budget.grossSalary - budget.tds - totalDeductions;
  const totalInvestments = budget.investments.reduce((s, i) => s + i.amount, 0);
  const totalFixed = budget.homeLoanEmi + budget.otherFixedLiabilities;
  const tab = inHand - totalInvestments - totalFixed;

  // Actuals from transactions for selected month
  const monthTxns = transactions.filter(t => t.month === selectedMonth && t.type === 'debit' && !['Salary', 'Investments', 'Credit Card Payment', 'Transfers'].includes(t.category));
  const actualByCategory: Record<string, number> = {};
  for (const t of monthTxns) {
    actualByCategory[t.category] = (actualByCategory[t.category] || 0) + t.amount;
  }

  function toggleGroup(group: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  }

  const oneTimeBudgeted = Object.entries(budget.categoryBudgets)
    .filter(([cat]) => CATEGORY_GROUPS.find(g => g.group === 'One Time / Non-Budgeted')?.categories.includes(cat))
    .reduce((s, [, v]) => s + v, 0);
  const oneTimeActual = Object.entries(actualByCategory)
    .filter(([cat]) => CATEGORY_GROUPS.find(g => g.group === 'One Time / Non-Budgeted')?.categories.includes(cat))
    .reduce((s, [, v]) => s + v, 0);

  const totalBudgeted = Object.values(budget.categoryBudgets).reduce((s, v) => s + v, 0) - oneTimeBudgeted;
  const totalActual = Object.values(actualByCategory).reduce((s, v) => s + v, 0) - oneTimeActual;

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <Header title="Monthly Budget" />
      <div style={{ padding: '1.5rem', maxWidth: '960px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Month selector + Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9' }}
          />
          <button className="btn-primary" onClick={handleSave}>
            {saved ? 'Saved!' : 'Save Budget'}
          </button>
        </div>

        {/* Income */}
        <Section title="Income">
          <Row label="Gross Salary" value={<NumInput value={budget.grossSalary} onChange={v => patch('grossSalary', v)} />} />
          <Row label="TDS / Tax Deducted at Source" value={<NumInput value={budget.tds} onChange={v => patch('tds', v)} />} indent />
          <Row label="Employer Health Insurance" value={<NumInput value={budget.employerHealthInsurance} onChange={v => patch('employerHealthInsurance', v)} />} indent />
          <Row label="EPF (Employee Contribution)" value={<NumInput value={budget.epf} onChange={v => patch('epf', v)} />} indent />
          <Row label="NPS (Employee Contribution)" value={<NumInput value={budget.nps} onChange={v => patch('nps', v)} />} indent />
          <Row label="Professional Tax" value={<NumInput value={budget.professionalTax} onChange={v => patch('professionalTax', v)} />} indent />
          <Row label="Other Deductions" value={<NumInput value={budget.otherDeductions} onChange={v => patch('otherDeductions', v)} />} indent />
          <Row label="In Hand Salary" value={<span style={{ color: '#4ade80', fontWeight: 600 }}>{fmt(inHand)}</span>} highlight />
        </Section>

        {/* Investments */}
        <Section title="Planned Investments">
          {budget.investments.map((inv, idx) => (
            <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0' }}>
              <input
                value={inv.label}
                onChange={e => {
                  const updated = [...budget.investments];
                  updated[idx] = { ...inv, label: e.target.value };
                  patch('investments', updated);
                }}
                style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                placeholder="Investment name"
              />
              <select
                value={inv.goal}
                onChange={e => {
                  const updated = [...budget.investments];
                  updated[idx] = { ...inv, goal: e.target.value as InvestmentLine['goal'] };
                  patch('investments', updated);
                }}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: '180px' }}
              >
                {INVESTMENT_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <NumInput value={inv.amount} onChange={v => {
                const updated = [...budget.investments];
                updated[idx] = { ...inv, amount: v };
                patch('investments', updated);
              }} />
              <button
                onClick={() => patch('investments', budget.investments.filter((_, i) => i !== idx))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            className="btn-ghost"
            onClick={() => patch('investments', [...budget.investments, { id: generateId(), label: '', amount: 0, goal: 'Other' }])}
            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <PlusCircle size={14} /> Add Investment
          </button>

          {/* Goal breakdown */}
          {INVESTMENT_GOALS.filter(g => budget.investments.some(i => i.goal === g && i.amount > 0)).map(goal => {
            const total = budget.investments.filter(i => i.goal === goal).reduce((s, i) => s + i.amount, 0);
            return (
              <div key={goal} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid #1e293b', marginTop: '0.25rem' }}>
                <span>{goal}</span>
                <span>{fmt(total)}</span>
              </div>
            );
          })}
          <Row label="Total Investments" value={<span style={{ color: '#60a5fa', fontWeight: 600 }}>{fmt(totalInvestments)}</span>} highlight />
        </Section>

        {/* Fixed Liabilities */}
        <Section title="Fixed Liabilities">
          <Row label="Home Loan EMI / Pre-EMI" value={<NumInput value={budget.homeLoanEmi} onChange={v => patch('homeLoanEmi', v)} />} />
          <Row label="Other Fixed Liabilities" value={<NumInput value={budget.otherFixedLiabilities} onChange={v => patch('otherFixedLiabilities', v)} />} />
          <Row label="Total Fixed" value={<span style={{ color: '#f87171', fontWeight: 600 }}>{fmt(totalFixed)}</span>} highlight />
        </Section>

        {/* TAB Summary */}
        <div className="card" style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#60a5fa', marginBottom: '0.25rem' }}>Total Available Budget (TAB)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: tab >= 0 ? '#4ade80' : '#f87171' }}>{fmt(tab)}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                In Hand {fmt(inHand)} − Investments {fmt(totalInvestments)} − Fixed {fmt(totalFixed)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Budgeted vs Actual</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>{fmt(totalBudgeted)} / {fmt(totalActual)}</div>
              <div style={{ fontSize: '0.75rem', color: totalActual > totalBudgeted ? '#f87171' : '#4ade80' }}>
                {totalBudgeted > 0 ? pct(totalActual, totalBudgeted) + ' of budget used' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Budget vs Actual per group */}
        {CATEGORY_GROUPS.map(({ group, categories }) => {
          const isOneTime = group === 'One Time / Non-Budgeted';
          const groupBudgeted = categories.reduce((s, cat) => s + (budget.categoryBudgets[cat] || 0), 0);
          const groupActual = categories.reduce((s, cat) => s + (actualByCategory[cat] || 0), 0);
          const isCollapsed = collapsedGroups.has(group);

          return (
            <div key={group} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                onClick={() => toggleGroup(group)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', cursor: 'pointer', background: '#1e293b', borderBottom: isCollapsed ? 'none' : '1px solid #334155' }}
              >
                {isCollapsed ? <ChevronRight size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
                <span style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem', color: '#f1f5f9' }}>{group}</span>
                {!isOneTime && tab > 0 && groupBudgeted > 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{pct(groupBudgeted, tab)} of TAB</span>
                )}
                <span style={{ fontSize: '0.8125rem', color: '#64748b', minWidth: '80px', textAlign: 'right' }}>
                  {fmt(groupBudgeted)}
                </span>
                <span style={{ fontSize: '0.8125rem', color: groupActual > groupBudgeted && groupBudgeted > 0 ? '#f87171' : '#4ade80', minWidth: '80px', textAlign: 'right' }}>
                  {fmt(groupActual)}
                </span>
              </div>

              {!isCollapsed && (
                <div style={{ padding: '0.5rem 1rem 0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', color: '#475569', marginBottom: '0.5rem', paddingLeft: '1rem' }}>
                    <span style={{ flex: 1 }}>Category</span>
                    <span style={{ width: '130px', textAlign: 'right' }}>Budget</span>
                    <span style={{ width: '100px', textAlign: 'right' }}>Actual</span>
                    <span style={{ width: '80px', textAlign: 'right' }}>Δ</span>
                  </div>
                  {categories.map(cat => {
                    const budgeted = budget.categoryBudgets[cat] || 0;
                    const actual = actualByCategory[cat] || 0;
                    const delta = budgeted - actual;
                    return (
                      <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', paddingLeft: '1rem' }}>
                        <span style={{ flex: 1, fontSize: '0.8125rem', color: '#94a3b8' }}>{cat}</span>
                        <NumInput
                          value={budgeted}
                          onChange={v => {
                            const updated = { ...budget.categoryBudgets, [cat]: v };
                            patch('categoryBudgets', updated);
                          }}
                        />
                        <span style={{ width: '100px', textAlign: 'right', fontSize: '0.8125rem', color: actual > 0 ? '#cbd5e1' : '#475569' }}>
                          {fmt(actual)}
                        </span>
                        <span style={{ width: '80px', textAlign: 'right', fontSize: '0.8125rem', color: delta < 0 ? '#f87171' : delta > 0 ? '#4ade80' : '#475569' }}>
                          {budgeted > 0 || actual > 0 ? (delta >= 0 ? '+' : '') + fmt(delta) : ''}
                        </span>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem', marginTop: '0.25rem', borderTop: '1px solid #1e293b', paddingLeft: '1rem' }}>
                    <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 600, color: '#64748b' }}>Group Total</span>
                    <span style={{ width: '130px', textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8' }}>{fmt(groupBudgeted)}</span>
                    <span style={{ width: '100px', textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: groupActual > groupBudgeted && groupBudgeted > 0 ? '#f87171' : '#94a3b8' }}>{fmt(groupActual)}</span>
                    <span style={{ width: '80px', textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: groupBudgeted - groupActual < 0 ? '#f87171' : '#4ade80' }}>
                      {groupBudgeted > 0 || groupActual > 0 ? (groupBudgeted - groupActual >= 0 ? '+' : '') + fmt(groupBudgeted - groupActual) : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, indent, highlight }: { label: string; value: React.ReactNode; indent?: boolean; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.375rem 0',
      paddingLeft: indent ? '1rem' : 0,
      borderTop: highlight ? '1px solid #334155' : undefined,
      marginTop: highlight ? '0.5rem' : undefined,
      paddingTop: highlight ? '0.625rem' : '0.375rem',
    }}>
      <span style={{ fontSize: '0.8125rem', color: highlight ? '#f1f5f9' : indent ? '#64748b' : '#94a3b8', fontWeight: highlight ? 600 : 400 }}>{label}</span>
      {value}
    </div>
  );
}
