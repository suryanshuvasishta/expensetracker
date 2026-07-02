import type { Category } from '../types';
import { DEFAULT_CATEGORIES } from '../db/database';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export async function initGoogleAuth(_clientId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

export async function getGoogleAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response.access_token);
      },
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/** Imported categories keep their group when the sheet provides one; otherwise fall back
 *  to the matching default category's group so grouping survives a round-trip. */
function groupFor(name: string, provided?: string): string {
  if (provided?.trim()) return provided.trim();
  return DEFAULT_CATEGORIES.find(d => d.name.toLowerCase() === name.toLowerCase())?.group || 'Miscellaneous';
}

/**
 * Fetch categories from a Google Sheet.
 * Expects columns: Category Name | Keywords (comma-separated) | Color (hex) | Icon | Group
 */
export async function fetchCategoriesFromSheet(
  sheetId: string,
  accessToken: string,
  sheetName = 'Categories'
): Promise<Category[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A:E`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Google Sheets API error: ${res.status} ${res.statusText}`);

  const data = await res.json();
  const rows: string[][] = data.values || [];

  if (rows.length <= 1) return DEFAULT_CATEGORIES;

  // Skip header row
  const categories: Category[] = rows.slice(1)
    .filter(row => row[0]?.trim())
    .map((row, idx) => ({
      id: row[0].toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + idx,
      name: row[0].trim(),
      keywords: (row[1] || '').split(',').map(k => k.trim()).filter(Boolean),
      color: row[2]?.trim() || '#94a3b8',
      icon: row[3]?.trim() || '',
      group: groupFor(row[0].trim(), row[4]),
    }));

  return categories.length > 0 ? categories : DEFAULT_CATEGORIES;
}

/**
 * Parse categories from a raw CSV/TSV text export of the expense sheet.
 * Columns: Name, keywords;semicolon;separated, #color, icon, group
 */
export function parseCategoriesFromCSV(csvText: string): Category[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return DEFAULT_CATEGORIES;

  const categories: Category[] = lines.slice(1).map((line, idx) => {
    const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
    const name = parts[0] || `Category ${idx + 1}`;
    return {
      id: (parts[0] || `cat-${idx}`).toLowerCase().replace(/\s+/g, '-') + '-' + idx,
      name,
      keywords: (parts[1] || '').split(';').map(k => k.trim()).filter(Boolean),
      color: parts[2] || '#94a3b8',
      icon: parts[3] || '',
      group: groupFor(name, parts[4]),
    };
  }).filter(c => c.name);

  return categories.length > 0 ? categories : DEFAULT_CATEGORIES;
}
