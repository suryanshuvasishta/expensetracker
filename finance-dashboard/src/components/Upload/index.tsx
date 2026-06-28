import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { Header } from '../Layout/Header';
import { extractTextFromPDF, extractTransactionsFromXLS, parseStatement, finalizeTransactions, detectAccount } from '../../parsers';
import type { AccountType, UploadedFile } from '../../types';
import { generateId } from '../../parsers/base';

const ACCOUNT_OPTIONS: AccountType[] = [
  'HDFC Bank', 'ICICI Bank', 'Axis Credit Card', 'SBI Credit Card', 'ICICI Credit Card',
];

interface FileState {
  file: File;
  id: string;
  account: AccountType | 'Unknown';
  status: 'pending' | 'processing' | 'done' | 'error';
  count: number;
  error?: string;
  password?: string;
}

export function UploadPage() {
  const { addTransactions, addUploadedFile, uploadedFiles, deleteBySourceFile } = useStore();
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const [processing, setProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: FileState[] = acceptedFiles.map(file => ({
      file,
      id: generateId(),
      account: 'Unknown',
      status: 'pending',
      count: 0,
    }));
    setFileStates(prev => [...prev, ...newFiles]);
  }, []);

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

      const finalized = finalizeTransactions(parsed, fs.file.name);
      await addTransactions(finalized);

      const uploadRecord: UploadedFile = {
        id: fs.id,
        name: fs.file.name,
        account: account as AccountType,
        uploadedAt: new Date().toISOString(),
        transactionCount: finalized.length,
        month: finalized[0]?.month || new Date().toISOString().slice(0, 7),
        status: 'done',
      };
      await addUploadedFile(uploadRecord);

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
    <div style={{ flex: 1, overflow: 'auto' }}>
      <Header title="Upload Statements" />
      <div style={{ padding: '1.5rem', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? '#3b82f6' : '#334155'}`,
            borderRadius: '12px',
            padding: '3rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragActive ? 'rgba(59,130,246,0.08)' : '#1e293b',
            transition: 'all 0.2s',
          }}
        >
          <input {...getInputProps()} />
          <Upload size={40} color={isDragActive ? '#3b82f6' : '#475569'} style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: '#94a3b8', margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>
            {isDragActive ? 'Drop files here...' : 'Drag & drop bank statements here'}
          </p>
          <p style={{ color: '#475569', fontSize: '0.8125rem', margin: 0 }}>
            Supports PDF, CSV, XLS, XLSX — HDFC, ICICI, Axis CC, SBI CC, ICICI CC
          </p>
        </div>

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
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem', background: '#0f172a', borderRadius: '8px' }}>
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
    </div>
  );
}

interface FileRowProps {
  fs: FileState;
  onAccountChange: (a: AccountType) => void;
  onPasswordChange: (p: string) => void;
  onProcess: () => void;
  onRemove: () => void;
}

function FileRow({ fs, onAccountChange, onPasswordChange, onProcess, onRemove }: FileRowProps) {
  const [showPassword, setShowPassword] = useState(false);

  const statusIcon = {
    pending: <FileText size={16} color="#94a3b8" />,
    processing: <Loader2 size={16} color="#60a5fa" style={{ animation: 'spin 1s linear infinite' }} />,
    done: <CheckCircle size={16} color="#4ade80" />,
    error: <AlertCircle size={16} color="#f87171" />,
  }[fs.status];

  return (
    <div style={{ padding: '0.75rem', background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {statusIcon}
        <span style={{ flex: 1, fontSize: '0.8125rem', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fs.file.name}</span>
        <select
          value={fs.account}
          onChange={e => onAccountChange(e.target.value as AccountType)}
          style={{ width: '180px', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          disabled={fs.status === 'processing' || fs.status === 'done'}
        >
          <option value="Unknown">Auto-detect</option>
          {ACCOUNT_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {fs.status === 'done' && (
          <span style={{ fontSize: '0.75rem', color: '#4ade80', whiteSpace: 'nowrap' }}>{fs.count} txns</span>
        )}
        {(fs.status === 'pending' || fs.status === 'error') && (
          <button className="btn-primary" onClick={onProcess} style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
            Process
          </button>
        )}
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
          <Trash2 size={14} />
        </button>
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
