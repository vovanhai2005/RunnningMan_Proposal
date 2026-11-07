-- =====================================================================
-- Cuộc đua — schema Phase 1 (mục 5 của kế hoạch)
-- Chạy một lần trong Supabase Dashboard → SQL Editor. Chạy lại nhiều lần vẫn an toàn.
-- =====================================================================

create extension if not exists pgcrypto;

-- Chặng: chỉ server (khóa service role) đọc được — RLS bật, KHÔNG có policy nào.
create table if not exists public.stages (
  id                 uuid primary key default gen_random_uuid(),
  stage_order        int  not null unique check (stage_order >= 1),  -- thứ tự chặng 1..4
  title              text not null,
  lat                double precision not null,
  lng                double precision not null,
  qr_token           text not null unique,          -- mã bí mật trong link QR
  manual_code        text not null unique,          -- mã chữ in dưới QR
  puzzle_text        text not null default '',
  puzzle_image_url   text,
  answers            text[] not null default '{}',  -- các cách viết được chấp nhận
  hints              text[] not null default '{}',
  success_message    text not null default '',
  route_polyline     jsonb,                         -- [[lat,lng],...] đã rút gọn
  route_distance_m   int,
  route_duration_s   int,
  route_approximate  boolean not null default false,
  updated_at         timestamptz not null default now()
);

-- Người chơi: mỗi tài khoản Supabase Auth một dòng.
create table if not exists public.players (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users(id) on delete cascade,
  display_name   text not null,
  avatar_url     text,
  current_stage  int  not null default 1,           -- sửa tay ô này để mở khóa chặng
  status         text not null default 'traveling'
                   check (status in ('traveling', 'solving', 'finished')),
  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- Tiến trình theo từng chặng.
create table if not exists public.progress (
  id                    uuid primary key default gen_random_uuid(),
  player_id             uuid not null references public.players(id) on delete cascade,
  stage_id              uuid not null references public.stages(id) on delete cascade,
  scanned_at            timestamptz,
  solved_at             timestamptz,
  wrong_attempts        int not null default 0,
  hints_shown           int not null default 0,
  attempt_window_start  timestamptz,
  attempt_window_count  int not null default 0,
  -- tuyến riêng của chặng 1 (tính từ vị trí lúc bấm "Bắt đầu")
  route_polyline        jsonb,
  route_distance_m      int,
  route_duration_s      int,
  route_approximate     boolean not null default false,
  unique (player_id, stage_id)
);

alter table public.stages   enable row level security;
alter table public.players  enable row level security;
alter table public.progress enable row level security;

drop policy if exists "players: read own" on public.players;
create policy "players: read own" on public.players
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "progress: read own" on public.progress;
create policy "progress: read own" on public.progress
  for select to authenticated
  using (player_id in (select id from public.players where user_id = auth.uid()));

-- Không cấp quyền ghi cho trình duyệt: mọi thay đổi đi qua API của server.
revoke insert, update, delete on public.stages, public.players, public.progress from anon, authenticated;
revoke all on public.stages from anon, authenticated;

-- Ảnh avatar (công khai để hiện trên bản đồ)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
