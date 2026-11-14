-- Orbital Medic initial schema. Run in the Supabase SQL editor.
-- Service role used by server routes bypasses RLS. Authenticated crew can read the mission.

create extension if not exists pgcrypto;

create type crew_role as enum ('commander','pilot','engineer','scientist','medical_officer','specialist');
create type location_source as enum ('chat','manual','sensor');
create type alert_severity as enum ('info','warning','critical');
create type alert_status as enum ('open','acknowledged','resolved');
create type message_role as enum ('user','assistant','system');

create table missions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ship_name text not null,
  launch_date date,
  status text not null default 'active'
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role crew_role,
  created_at timestamptz not null default now()
);

create table astronauts (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id),
  profile_id uuid references profiles (id),
  callsign text not null,
  full_name text not null,
  role crew_role not null,
  age int,
  sex text,
  weight_kg numeric,
  height_cm numeric,
  blood_type text,
  allergies text[] default '{}',
  conditions text[] default '{}',
  medications text[] default '{}',
  baseline_hr int,
  baseline_spo2 int,
  baseline_bp_sys int,
  baseline_bp_dia int,
  baseline_temp_c numeric,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table ship_zones (
  id text primary key,
  mission_id uuid references missions (id),
  label text not null,
  deck int not null default 1,
  aliases text[] default '{}',
  position jsonb not null,
  size jsonb not null
);

create table crew_locations (
  id uuid primary key default gen_random_uuid(),
  astronaut_id uuid not null references astronauts (id),
  zone_id text not null references ship_zones (id),
  source location_source not null default 'chat',
  created_at timestamptz not null default now()
);

create table vitals (
  id bigint generated always as identity primary key,
  astronaut_id uuid not null references astronauts (id),
  recorded_at timestamptz not null default now(),
  heart_rate numeric,
  spo2 numeric,
  bp_sys numeric,
  bp_dia numeric,
  resp_rate numeric,
  temp_c numeric,
  hrv numeric,
  stress_index numeric,
  hydration_pct numeric
);
create index vitals_astronaut_time on vitals (astronaut_id, recorded_at desc);
-- Scalability TODO: partition vitals by month and drop rows older than the mission retention window.

create table environment_readings (
  id bigint generated always as identity primary key,
  mission_id uuid not null references missions (id),
  zone_id text references ship_zones (id),
  recorded_at timestamptz not null default now(),
  o2_pct numeric,
  co2_ppm numeric,
  pressure_kpa numeric,
  temp_c numeric,
  humidity_pct numeric,
  radiation_msv_h numeric
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  astronaut_id uuid references astronauts (id),
  zone_id text references ship_zones (id),
  type text not null default 'threshold',
  severity alert_severity not null,
  message text not null,
  data jsonb default '{}',
  status alert_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  astronaut_id uuid references astronauts (id),
  started_at timestamptz not null default now(),
  status text not null default 'open',
  location_zone_id text references ship_zones (id),
  urgency_peak text
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  role message_role not null,
  content text not null,
  structured jsonb,
  urgency text,
  created_at timestamptz not null default now()
);

create table action_checklists (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages (id) on delete cascade,
  item text not null,
  done boolean not null default false,
  done_at timestamptz
);

create table medkit_inventory (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id),
  zone_id text references ship_zones (id),
  item_name text not null,
  quantity int not null default 1,
  notes text
);

create table escalations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations (id),
  astronaut_id uuid references astronauts (id),
  reason text not null,
  sent_at timestamptz not null default now(),
  ack_at timestamptz
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text,
  action text not null,
  entity text,
  entity_id text,
  payload jsonb default '{}',
  created_at timestamptz not null default now()
);

create view current_location with (security_invoker = true) as
select distinct on (astronaut_id) *
from crew_locations
order by astronaut_id, created_at desc;

alter table missions enable row level security;
alter table profiles enable row level security;
alter table astronauts enable row level security;
alter table ship_zones enable row level security;
alter table crew_locations enable row level security;
alter table vitals enable row level security;
alter table environment_readings enable row level security;
alter table alerts enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table action_checklists enable row level security;
alter table medkit_inventory enable row level security;
alter table escalations enable row level security;
alter table audit_log enable row level security;

create policy "crew read missions" on missions for select to authenticated using (true);
create policy "crew read astronauts" on astronauts for select to authenticated using (true);
create policy "crew read zones" on ship_zones for select to authenticated using (true);
create policy "crew read vitals" on vitals for select to authenticated using (true);
create policy "crew read environment" on environment_readings for select to authenticated using (true);
create policy "crew read alerts" on alerts for select to authenticated using (true);
create policy "crew update alerts" on alerts for update to authenticated using (true);
create policy "crew read locations" on crew_locations for select to authenticated using (true);
create policy "crew insert own locations" on crew_locations for insert to authenticated with check (true);
create policy "crew read conversations" on conversations for select to authenticated using (true);
create policy "crew insert conversations" on conversations for insert to authenticated with check (true);
create policy "crew read messages" on messages for select to authenticated using (true);
create policy "crew insert messages" on messages for insert to authenticated with check (true);
create policy "crew read checks" on action_checklists for select to authenticated using (true);
create policy "crew update checks" on action_checklists for update to authenticated using (true);
create policy "crew read medkit" on medkit_inventory for select to authenticated using (true);
create policy "crew read escalations" on escalations for select to authenticated using (true);
create policy "crew insert escalations" on escalations for insert to authenticated with check (true);
create policy "crew read own profile" on profiles for select to authenticated using (id = auth.uid());
create policy "crew read audit" on audit_log for select to authenticated using (true);

alter publication supabase_realtime add table vitals;
alter publication supabase_realtime add table alerts;
alter publication supabase_realtime add table crew_locations;
alter publication supabase_realtime add table environment_readings;
