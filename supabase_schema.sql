-- Glide Homes Production Schema for Supabase
-- Run this script once in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

create extension if not exists "pgcrypto";

-- Helper function for admin check
create or replace function public.is_glide_admin()
returns boolean
language sql
stable
security definer
as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') = 'ibrahimjamiuakofe08@gmail.com',
    false
  );
$$;

-- 1. PROFILES TABLE (extends existing public.profiles safely)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'buyer',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists user_code text,
  add column if not exists state text not null default '',
  add column if not exists is_verified boolean not null default false,
  add column if not exists is_blocked boolean not null default false,
  add column if not exists kyc_status text not null default 'unsubmitted',
  add column if not exists kyc_rejection_reason text,
  add column if not exists agent_upgrade_status text not null default 'none',
  add column if not exists agent_upgrade_reason text,
  add column if not exists is_admin boolean not null default false;

create unique index if not exists profiles_user_code_idx on public.profiles(user_code) where user_code is not null;

-- Auto-create profile row whenever a new auth.users record is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
begin
  generated_code := coalesce(
    nullif(new.raw_user_meta_data ->> 'user_code', ''),
    lpad((floor(random() * 89999999 + 10000000))::bigint::text, 8, '0')
  );

  insert into public.profiles (
    id, email, full_name, phone, role, state, user_code, is_admin
  )
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'buyer'),
    coalesce(new.raw_user_meta_data ->> 'state', ''),
    generated_code,
    lower(new.email) = 'ibrahimjamiuakofe08@gmail.com'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case when excluded.full_name <> '' then excluded.full_name else public.profiles.full_name end,
    phone = case when excluded.phone <> '' then excluded.phone else public.profiles.phone end,
    role = case when excluded.role <> '' then excluded.role else public.profiles.role end,
    state = case when excluded.state <> '' then excluded.state else public.profiles.state end,
    user_code = coalesce(public.profiles.user_code, excluded.user_code);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
drop policy if exists "Public can read profiles" on public.profiles;
create policy "Public can read profiles" on public.profiles for select using (true);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id or public.is_glide_admin());
drop policy if exists "Users can update own profile or admin" on public.profiles;
create policy "Users can update own profile or admin" on public.profiles for update using (auth.uid() = id or public.is_glide_admin());

-- 2. HOUSES TABLE (extends existing public.houses safely)
create table if not exists public.houses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text not null default '',
  price numeric not null default 0,
  image_url text not null default '',
  description text not null default '',
  bedrooms int not null default 1,
  bathrooms int not null default 1,
  created_at timestamptz not null default now()
);

alter table public.houses
  add column if not exists agent_id uuid references public.profiles(id) on delete set null,
  add column if not exists agent_code text,
  add column if not exists agent_name text,
  add column if not exists agent_verified boolean not null default false,
  add column if not exists house_number text not null default '',
  add column if not exists street_name text not null default '',
  add column if not exists area text not null default '',
  add column if not exists state text not null default 'Lagos',
  add column if not exists country text not null default 'Nigeria',
  add column if not exists inspection_fee numeric not null default 3000,
  add column if not exists house_type text not null default '2 Bedroom',
  add column if not exists phone text not null default '',
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists amenities jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'Available',
  add column if not exists approval_status text not null default 'pending',
  add column if not exists rejection_reason text,
  add column if not exists lat double precision,
  add column if not exists lng double precision;

alter table public.houses enable row level security;
drop policy if exists "Anyone can view approved or own houses" on public.houses;
create policy "Anyone can view approved or own houses" on public.houses
  for select using (
    coalesce(approval_status, 'approved') = 'approved'
    or auth.uid() = agent_id
    or public.is_glide_admin()
  );
drop policy if exists "Authenticated users can insert houses" on public.houses;
create policy "Authenticated users can insert houses" on public.houses
  for insert with check (auth.uid() = agent_id or auth.uid() is not null);
drop policy if exists "Owner or admin can update houses" on public.houses;
create policy "Owner or admin can update houses" on public.houses
  for update using (auth.uid() = agent_id or public.is_glide_admin());
drop policy if exists "Owner or admin can delete houses" on public.houses;
create policy "Owner or admin can delete houses" on public.houses
  for delete using (auth.uid() = agent_id or public.is_glide_admin());

-- 3. BOOKINGS TABLE (extends existing public.bookings safely)
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  house_id uuid references public.houses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null default '',
  phone text not null default '',
  check_in text not null default '',
  check_out text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.bookings
  add column if not exists agent_id uuid,
  add column if not exists house_title text,
  add column if not exists preferred_date text,
  add column if not exists preferred_time text,
  add column if not exists notes text not null default '';

alter table public.bookings enable row level security;
drop policy if exists "Anyone can create bookings" on public.bookings;
create policy "Anyone can create bookings" on public.bookings for insert with check (true);
drop policy if exists "Buyers, property agents, and admin can view bookings" on public.bookings;
create policy "Buyers, property agents, and admin can view bookings" on public.bookings
  for select using (
    auth.uid() = user_id
    or auth.uid() = agent_id
    or exists (select 1 from public.houses h where h.id = house_id and h.agent_id = auth.uid())
    or public.is_glide_admin()
  );
drop policy if exists "Admin or property agent can update bookings" on public.bookings;
create policy "Admin or property agent can update bookings" on public.bookings
  for update using (
    public.is_glide_admin()
    or auth.uid() = agent_id
    or exists (select 1 from public.houses h where h.id = house_id and h.agent_id = auth.uid())
  );

-- 4. FAVORITES TABLE
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  house_id uuid not null references public.houses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, house_id)
);
alter table public.favorites enable row level security;
drop policy if exists "Users manage own favorites" on public.favorites;
create policy "Users manage own favorites" on public.favorites
  for all using (auth.uid() = user_id or public.is_glide_admin())
  with check (auth.uid() = user_id);

-- 5. KYC REQUESTS TABLE
create table if not exists public.kyc_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  id_type text not null default 'NIN',
  id_number text not null,
  id_card_url text,
  selfie_url text not null,
  liveness_video_url text,
  status text not null default 'pending',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.kyc_requests enable row level security;
drop policy if exists "Users and admin read KYC" on public.kyc_requests;
create policy "Users and admin read KYC" on public.kyc_requests
  for select using (auth.uid() = user_id or public.is_glide_admin());
drop policy if exists "Users submit own KYC" on public.kyc_requests;
create policy "Users submit own KYC" on public.kyc_requests
  for insert with check (auth.uid() = user_id);
drop policy if exists "Admin updates KYC" on public.kyc_requests;
create policy "Admin updates KYC" on public.kyc_requests
  for update using (public.is_glide_admin() or auth.uid() = user_id);

-- 6. AGENT UPGRADE REQUESTS TABLE
create table if not exists public.agent_upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note text not null default '',
  status text not null default 'pending',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.agent_upgrade_requests enable row level security;
drop policy if exists "Users and admin read upgrades" on public.agent_upgrade_requests;
create policy "Users and admin read upgrades" on public.agent_upgrade_requests
  for select using (auth.uid() = user_id or public.is_glide_admin());
drop policy if exists "Users insert upgrade request" on public.agent_upgrade_requests;
create policy "Users insert upgrade request" on public.agent_upgrade_requests
  for insert with check (auth.uid() = user_id);
drop policy if exists "Admin updates upgrade request" on public.agent_upgrade_requests;
create policy "Admin updates upgrade request" on public.agent_upgrade_requests
  for update using (public.is_glide_admin());

-- 7. HOME ITEMS TABLE
create table if not exists public.home_items (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  seller_name text not null default '',
  seller_code text not null default '',
  title text not null,
  category text not null,
  condition text not null,
  price numeric not null,
  area text not null,
  state text not null,
  country text not null default 'Nigeria',
  phone text not null,
  images jsonb not null default '[]'::jsonb,
  description text not null default '',
  status text not null default 'Available',
  approval_status text not null default 'pending',
  rejection_reason text,
  created_at timestamptz not null default now()
);
alter table public.home_items enable row level security;
drop policy if exists "Anyone views approved or own items" on public.home_items;
create policy "Anyone views approved or own items" on public.home_items
  for select using (
    approval_status = 'approved'
    or auth.uid() = seller_id
    or public.is_glide_admin()
  );
drop policy if exists "Authenticated insert items" on public.home_items;
create policy "Authenticated insert items" on public.home_items
  for insert with check (auth.uid() = seller_id);
drop policy if exists "Owner or admin update items" on public.home_items;
create policy "Owner or admin update items" on public.home_items
  for update using (auth.uid() = seller_id or public.is_glide_admin());
drop policy if exists "Owner or admin delete items" on public.home_items;
create policy "Owner or admin delete items" on public.home_items
  for delete using (auth.uid() = seller_id or public.is_glide_admin());

-- 8. USER REPORTS TABLE
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reported_uid text not null,
  reported_user_id uuid,
  reported_user_name text not null default '',
  reported_user_email text not null default '',
  reported_user_phone text not null default '',
  reported_user_role text not null default '',
  reporter_name text not null default 'Anonymous',
  reporter_contact text not null default '',
  listing_type text not null default 'general',
  listing_id text not null default '',
  reason text not null,
  status text not null default 'open',
  admin_action_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_reports enable row level security;
drop policy if exists "Anyone can file report" on public.user_reports;
create policy "Anyone can file report" on public.user_reports for insert with check (true);
drop policy if exists "Admin reads and updates reports" on public.user_reports;
create policy "Admin reads and updates reports" on public.user_reports
  for all using (public.is_glide_admin());

-- 9. ADMIN BROADCAST NOTES TABLE
create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.admin_notes enable row level security;
drop policy if exists "Public can read admin notes" on public.admin_notes;
create policy "Public can read admin notes" on public.admin_notes for select using (true);
drop policy if exists "Admin manages notes" on public.admin_notes;
create policy "Admin manages notes" on public.admin_notes
  for all using (public.is_glide_admin())
  with check (public.is_glide_admin());

-- 10. LOGIN LOGS TABLE
create table if not exists public.login_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_code text not null default '',
  full_name text not null default '',
  email text not null default '',
  role text not null default 'buyer',
  logged_in_at timestamptz not null default now()
);
alter table public.login_logs enable row level security;
drop policy if exists "Authenticated users log own login" on public.login_logs;
create policy "Authenticated users log own login" on public.login_logs
  for insert with check (auth.uid() = user_id or public.is_glide_admin());
drop policy if exists "Admin reads login logs" on public.login_logs;
create policy "Admin reads login logs" on public.login_logs
  for select using (public.is_glide_admin() or auth.uid() = user_id);

-- 11. STORAGE BUCKET FOR PROPERTY & KYC MEDIA
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "Public can view media" on storage.objects;
create policy "Public can view media" on storage.objects
  for select using (bucket_id = 'media');
drop policy if exists "Authenticated users upload media" on storage.objects;
create policy "Authenticated users upload media" on storage.objects
  for insert with check (bucket_id = 'media' and auth.uid() is not null);
