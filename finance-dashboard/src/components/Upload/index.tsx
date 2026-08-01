import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { extractTextFromPDF, extractTransactionsFromXLS, parseStatement, finalizeTransactions, detectAccount } from '../../parsers';
import { normalizeNarration } from '../../services/correlator';
import type { AccountType, UploadedFile, Owner } from '../../types';
import { OWNERS } from '../../types';
import { generateId } from '../../parsers/base';

const ACCOUNT_OPTIONS: AccountType[] = [
  'HDFC Bank', 'ICICI Bank', 'Axis Credit Card', 'SBI Credit Card', 'ICICI Credit Card', 'Paytm Wallet',
];

interface FileState {
  file: File;
  id: string;
  account: AccountType | 'Unknown';
  owner: Owner;
  status: 'pending' | 'processing' | 'done' | 'error';
  count: number;
  error?: string;
  password?: string;
}

/** Statement import UI — drag/drop bank & CC statements, review previously
 *  uploaded files. Embedded at the bottom of the Transactions page rather
 *  than living on its own tab, since imports and manual entries both feed
 *  the same list and the Kakeibo check that reconciles them. */
export function ImportPanel() {
  const { addTransactions, addUploadedFile, uploadedFiles, deleteBySourceFile, selectedOwner, selectedMonth, setSelectedMonth, transactions } = useStore();
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const [processing, setProcessing] = useState(false);
  const [importedMonths, setImportedMonths] = useState<string[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: FileState[] = acceptedFiles.map(file => ({
      file,
      id: generateId(),
      account: 'Unknown',
      owner: (selectedOwner === 'All' ? 'Suryanshu' : selectedOwner) as Owner,
      status: 'pending',
      count: 0,
    }));
    setFileStates(prev => [...prev, ...newFiles]);
  }, [selectedOwner]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/csv': ['.csv'], 'text/plain': ['.txt'], 'application/vnd.ms-excel': ['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    multiple: true,
  });

  function updateFileState(id: string, patch: Partial<FileState>) {
    setFileStates(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }

  async function processFile(fs: FileState) {
    updateFileState(fs.id, { status: 'processing' });
    try {
      let parsed;
      let account: AccountType | 'Unknown' = fs.account;

      if (fs.file.name.endsWith('.xls') || fs.file.name.endsWith('.xlsx')) {
        parsed = await extractTransactionsFromXLS(fs.file);
        if (parsed.length > 0) account = parsed[0].account as AccountType;
      } else {
        let text = '';
        if (fs.file.name.endsWith('.pdf')) {
          text = await extractTextFromPDF(fs.file, fs.password);
        } else {
          text = await fs.file.text();
        }
        account = fs.account !== 'Unknown' ? fs.account : detectAccount(text, fs.file.name);
        parsed = parseStatement(text, fs.file.name, account);
      }

      if (parsed.length === 0) {
        updateFileState(fs.id, { status: 'error', error: 'No transactions found. Try selecting the account manually or check if the PDF needs a password.' });
        return;
      }

      const finalized = finalizeTransactions(parsed, fs.file.name, fs.owner);

      // Warn if this looks like a re-upload of an overlapping statement
      const existingKeys = new Set(
        transactions.map(t => `${t.account}|${t.date}|${t.amount}|${t.type}|${normalizeNarration(t.narration)}`)
      );
      const dupCount = finalized.filter(t =>
        existingKeys.has(`${t.account}|${t.date}|${t.amount}|${t.type}|${normalizeNarration(t.narration)}`)
      ).length;
      if (dupCount > 0) {
        const proceed = window.confirm(
          `${dupCount} of ${finalized.length} transactions in "${fs.file.name}" already exist ` +
          `(possibly an overlapping statement). Import anyway?\n\nDuplicates will be skipped automatically.`
        );
        if (!proceed) {
          updateFileState(fs.id, { status: 'error', error: `Skipped — ${dupCount} of ${finalized.length} transactions already exist.` });
          return;
        }
      }

      await addTransactions(finalized);

      const uploadRecord: UploadedFile = {
        id: fs.id,
        owner: fs.owner,
        name: fs.file.name,
        account: account as AccountType,
        uploadedAt: new Date().toISOString(),
        transactionCount: finalized.length,
        month: finalized[0]?.month || new Date().toISOString().slice(0, 7),
        status: 'done',
      };
      await addUploadedFile(uploadRecord);

      const monthsInFile = [...new Set(finalized.map(t => t.month))];
      setImportedMonths(prev => [...new Set([...prev, ...monthsInFile])]);

      updateFileState(fs.id, { status: 'done', count: finalized.length, account: account as AccountType });
    } catch (err: any) {
      const msg = err?.message || String(err);
      const needsPassword = msg.toLowerCase().includes('password') || msg.toLowerCase().includes('encrypted');
      updateFileState(fs.id, {
        status: 'error',
        error: needsPassword ? 'This PDF is password-protected. Enter the password below and retry.' : msg,
      });
    }
  }

  async function processAll() {
    setProcessing(true);
    const pending = fileStates.filter(f => f.status === 'pending' || f.status === 'error');
    for (const fs of pending) {
      await processFile(fs);
    }
    setProcessing(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? '#3b82f6' : 'var(--border)'}`,
          borderRadius: '12px',
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragActive ? 'rgba(59,130,246,0.08)' : 'var(--bg-elevated)',
          transition: 'all 0.2s',
        }}
      >
        <input {...getInputProps()} />
        <Upload size={32} color={isDragActive ? '#3b82f6' : 'var(--text-faint)'} style={{ margin: '0 auto 0.75rem' }} />
        <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>
          {isDragActive ? 'Drop files here...' : 'Drag & drop bank / credit card statements here'}
        </p>
        <p style={{ color: 'var(--text-faint)', fontSize: '0.8125rem', margin: 0 }}>
          Supports PDF, CSV, XLS, XLSX — HDFC, ICICI, Axis CC, SBI CC, ICICI CC, Paytm
        </p>
      </div>

      {/* Imported-month mismatch warning */}
      {importedMonths.some(m => m !== selectedMonth) && (
        <div className="card" style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.3)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <AlertCircle size={16} color="#fbbf24" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.8125rem', color: '#fbbf24', flex: 1 }}>
            Imported transactions for {importedMonths.filter(m => m !== selectedMonth).join(', ')} —
            you're currently viewing {selectedMonth} and won't see them until you switch months.
          </span>
          {importedMonths.filter(m => m !== selectedMonth).map(m => (
            <button key={m} className="btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }} onClick={() => setSelectedMonth(m)}>
              Switch to {m}
            </button>
          ))}
        </div>
      )}

      {/* File list */}
      {fileStates.length > 0 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>Files to Process</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-ghost" onClick={() => setFileStates([])}>Clear all</button>
              <button
                className="btn-primary"
                onClick={processAll}
                disabled={processing || fileStates.every(f => f.status === 'done')}
              >
                {processing ? 'Processing...' : 'Process All'}
              </button>
            </div>
          </div>
          {fileStates.map(fs => (
            <FileRow
              key={fs.id}
              fs={fs}
              onAccountChange={account => updateFileState(fs.id, { account })}
              onOwnerChange={owner => updateFileState(fs.id, { owner })}
              onPasswordChange={password => updateFileState(fs.id, { password })}
              onProcess={() => processFile(fs)}
              onRemove={() => setFileStates(prev => prev.filter(f => f.id !== fs.id))}
            />
          ))}
        </div>
      )}

      {/* Previously uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>Uploaded Files</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {uploadedFiles.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <FileText size={16} color="#64748b" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{f.account} · {f.transactionCount} transactions · {f.month}</div>
                </div>
                <button
                  onClick={() => deleteBySourceFile(f.name)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', borderRadius: '4px' }}
                  title="Delete transactions from this file"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card" style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.25)' }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#60a5fa' }}>Tips for best results</h4>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#94a3b8', fontSize: '0.8125rem', lineHeight: 1.7 }}>
          <li>Download statements as PDF from your bank's net banking portal</li>
          <li>HDFC statements are often password-protected with your customer ID or date of birth</li>
          <li>For ICICI Bank: use the "Download Statement" option, not "Email Statement"</li>
          <li>Credit card statements should be the "Detailed Statement" not "Summary"</li>
          <li>If auto-detection fails, select the account type manually from the dropdown</li>
        </ul>
      </div>
    </div>
  );
}

interface FileRowProps {
  fs: FileState;
  onAccountChange: (a: AccountType) => void;
  onOwnerChange: (o: Owner) => void;
  onPasswordChange: (p: string) => void;
  onProcess: () => void;
  onRemove: () => void;
}

function FileRow({ fs, onAccountChange, onOwnerChange, onPasswordChange, onProcess, onRemove }: FileRowProps) {
  const [showPassword, setShowPassword] = useState(false);

  const statusIcon = {
    pending: <FileText size={16} color="#94a3b8" />,
    processing: <Loader2 size={16} color="#60a5fa" style={{ animation: 'spin 1s linear infinite' }} />,
    done: <CheckCircle size={16} color="#4ade80" />,
    error: <AlertCircle size={16} color="#f87171" />,
  }[fs.status];

  return (
    <div style={{ padding: '0.75rem', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          {statusIcon}
          <span style={{ flex: 1, fontSize: '0.8125rem', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{fs.file.name}</span>
        </div>
        <div className="file-row-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            value={fs.owner}
            onChange={e => onOwnerChange(e.target.value as Owner)}
            style={{ width: '110px', padding: '0.375rem 0.5rem', fontSize: '0.75rem' }}
            disabled={fs.status === 'processing' || fs.status === 'done'}
          >
            {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select
            value={fs.account}
            onChange={e => onAccountChange(e.target.value as AccountType)}
            style={{ width: '170px', padding: '0.375rem 0.5rem', fontSize: '0.75rem' }}
            disabled={fs.status === 'processing' || fs.status === 'done'}
          >
            <option value="Unknown">Auto-detect</option>
            {ACCOUNT_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {fs.status === 'done' && (
            <span style={{ fontSize: '0.75rem', color: '#4ade80', whiteSpace: 'nowrap' }}>{fs.count} txns</span>
          )}
          {(fs.status === 'pending' || fs.status === 'error') && (
            <button className="btn-primary" onClick={onProcess} style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', minHeight: 36 }}>
              Process
            </button>
          )}
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '10px', minWidth: 40, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {fs.status === 'error' && (
        <div style={{ marginTop: '0.5rem' }}>
          <p style={{ margin: '0 0 0.5rem', color: '#f87171', fontSize: '0.75rem' }}>{fs.error}</p>
          {fs.error?.includes('password') && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter PDF password..."
                onChange={e => onPasswordChange(e.target.value)}
                style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              />
              <button className="btn-ghost" onClick={() => setShowPassword(!showPassword)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
