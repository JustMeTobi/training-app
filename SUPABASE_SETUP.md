# ☁️ Setting up cloud sync (Supabase)

QuestFit can keep your phone and computer in sync through a free Supabase database. You set it up once; it takes about 5 minutes.

## 1. Create the project
1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New project**. Pick any name (e.g. `questfit`), a database password (you won't need it in the app), and the region closest to you.
3. Wait a minute while it's created.

## 2. Create the table
Open **SQL Editor** → **New query**, paste this and click **Run**:

```sql
create table public.saves (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
create policy "read own save" on public.saves for select using (auth.uid() = user_id);
create policy "insert own save" on public.saves for insert with check (auth.uid() = user_id);
create policy "update own save" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

The policies mean each account can only read and change its own save.

## 3. (Recommended) Turn off email confirmation
**Authentication** → **Sign In / Providers** → **Email** → turn off **Confirm email**. Then "Create account" in the app logs you in straight away. If you leave it on, you'll get a confirmation email first.

## 4. Connect the app
Open **Project Settings** → **API** (sometimes called *Data API* / *API Keys*) and copy:
- **Project URL** (looks like `https://abcdefgh.supabase.co`)
- **anon public** key (a long text starting with `eyJ…`)

Then either:
- **In the app:** Journey → ☁️ Cloud sync → paste both → *Save & continue*. Do this on each device. **or**
- **Once for all devices:** put them in `js/cloud-config.js` (or send them to Claude to do it), so each device only needs to log in.

The anon key is designed to be public. Your data is protected by the policies above, not by hiding the key.

## 5. Log in
On the first device: **Create account** with your email and a password. On every other device: **Log in** with the same email and password.

## How syncing works
- Changes upload a few seconds after you make them.
- When you open the app (or come back to it), it downloads changes from your other devices, and checks again every 2 minutes while it's open.
- If both devices changed something before syncing, the app asks which progress to keep.
