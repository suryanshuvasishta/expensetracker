# Google Drive Sync — one-time setup

The dashboard can sync all data between two people (Suryanshu ↔ Khushboo) through a
shared Google Drive folder, and writes monthly backups (CSV + JSON × Suryanshu /
Khushboo / Combined) there on every sync. Data still lives locally in each browser;
Drive is the exchange + backup layer.

## Step 1 — Create an OAuth Client ID (~10 minutes, once, either person)

1. Go to https://console.cloud.google.com/ and sign in.
2. Create a project (top bar → "New Project"), e.g. `finance-dashboard`.
3. **Enable the Drive API**: APIs & Services → Library → search "Google Drive API" → Enable.
4. **OAuth consent screen**: APIs & Services → OAuth consent screen
   - User type: **External** → Create
   - App name: `Finance Dashboard`, your email for the contact fields → Save
   - **Test users**: add BOTH Gmail addresses (yours and Khushboo's). The app stays in
     "Testing" mode forever — that's fine for personal use; only test users can connect.
5. **Create credentials**: APIs & Services → Credentials → Create Credentials → **OAuth client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://suryanshuvasishta.github.io`
     (add `http://localhost:5173` too if you ever run the app locally)
   - Create → copy the **Client ID** (`xxxxx.apps.googleusercontent.com`).

## Step 2 — Connect each device

On each person's browser, in the app: **Settings → Google Drive Sync**

1. Paste the same Client ID (share it between yourselves — it is not a secret).
2. Set "This device belongs to" (Suryanshu / Khushboo).
3. Click **Connect Google Drive** and sign in with your own Google account.
   You'll see an "unverified app" warning — click *Advanced → Go to Finance Dashboard* —
   this is expected for personal test-mode apps.
4. Click **Sync now**. The first sync creates a `FinanceDashboardSync` folder in that
   person's My Drive.

## Step 3 — Share the folder (once)

Whoever synced first: open Google Drive → right-click `FinanceDashboardSync` →
Share → add the other person's Gmail as **Editor**.

The other person then clicks **Sync now** in their app — it finds the shared folder
automatically and both devices exchange data from then on.

## How it works

- Each device uploads its full local data as `device-Suryanshu.json` / `device-Khushboo.json`
  and merges the other's file on every sync.
- Merging is by record ID with last-write-wins for transactions (an `updatedAt`
  timestamp is set whenever you edit), so a category correction made on one device
  propagates to the other without clobbering newer edits.
- Monthly backups `backup-YYYY-MM-{suryanshu,khushboo,combined}.{csv,json}` are
  rewritten in the folder on every sync — the CSV opens in Sheets/Excel, the JSON
  restores via Settings → Import Snapshot.
- Sync runs automatically when the app opens and ~20 seconds after you change
  transactions, plus on the **Sync now** button.

## Limitations to know

- **Deletions don't propagate**: a transaction deleted on one device can reappear
  after syncing if the other device still has it. Delete on both, or delete and
  immediately sync both devices.
- Google access tokens expire hourly; the app refreshes silently, but occasionally a
  sync may ask you to sign in again.
