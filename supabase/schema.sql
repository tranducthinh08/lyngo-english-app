-- ==============================================================================
-- LYNGO ENGLISH APP - SUPABASE DATABASE & STORAGE SCHEMA
-- Chạy script này trong phần "SQL Editor" của Supabase Dashboard (Run 1-chạm)
-- ==============================================================================

-- 1. BẢNG ALBUMS (Tủ sách / Cuốn sách của Cô Ly)
create table if not exists public.albums (
  id text primary key,
  title text not null,
  author text,
  cover_image text,
  description text,
  created_at bigint not null,
  updated_at bigint not null
);

-- Index tìm kiếm & sắp xếp
create index if not exists idx_albums_updated_at on public.albums(updated_at desc);

-- 2. BẢNG PAGES (Trang sách đã scan)
create table if not exists public.pages (
  id text primary key,
  album_id text references public.albums(id) on delete cascade,
  title text not null,
  page_number text,
  original_image text,
  extracted_text text not null,
  notes_count integer default 0,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists idx_pages_album_id on public.pages(album_id);
create index if not exists idx_pages_updated_at on public.pages(updated_at desc);

-- 3. BẢNG VOCAB_NOTES (Thẻ ghi nhớ từ vựng & mẹo nhớ của Cô Ly - Chuẩn Template & Anki SM-2)
create table if not exists public.vocab_notes (
  id text primary key,
  album_id text references public.albums(id) on delete set null,
  page_id text references public.pages(id) on delete set null,
  word text not null,
  phonetic text,
  audio_url text,
  part_of_speech text,
  meaning text not null,
  memory_type text default 'mnemonic',
  note text,
  example_en text,
  example_vi text,
  context_sentence text,
  image_url text,
  cambridge_url text,
  status text default 'learning',
  next_review_date bigint,
  interval integer default 1,
  repetitions integer default 0,
  ease_factor double precision default 2.5,
  last_reviewed_at bigint,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists idx_vocab_album_id on public.vocab_notes(album_id);
create index if not exists idx_vocab_page_id on public.vocab_notes(page_id);
create index if not exists idx_vocab_word on public.vocab_notes(word);
create index if not exists idx_vocab_next_review on public.vocab_notes(next_review_date);
create index if not exists idx_vocab_updated_at on public.vocab_notes(updated_at desc);

-- ==============================================================================
-- 4. THIẾT LẬP QUYỀN TRUY CẬP (GRANT PRIVILEGES) & ROW LEVEL SECURITY (RLS)
-- Cấp quyền cho anon và authenticated để truy cập qua Supabase API
-- ==============================================================================

-- 4.1 Cấp quyền Schema và Tables (Bắt buộc trong PostgreSQL)
grant usage on schema public to anon, authenticated, service_role;

grant all on table public.albums to anon, authenticated, service_role;
grant all on table public.pages to anon, authenticated, service_role;
grant all on table public.vocab_notes to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

-- 4.2 Bật Row Level Security (RLS) và cấp Policies
alter table public.albums enable row level security;
alter table public.pages enable row level security;
alter table public.vocab_notes enable row level security;

-- Albums Policies
drop policy if exists "Allow anon read albums" on public.albums;
drop policy if exists "Allow anon insert albums" on public.albums;
drop policy if exists "Allow anon update albums" on public.albums;
drop policy if exists "Allow anon delete albums" on public.albums;

create policy "Allow anon read albums" on public.albums for select using (true);
create policy "Allow anon insert albums" on public.albums for insert with check (true);
create policy "Allow anon update albums" on public.albums for update using (true);
create policy "Allow anon delete albums" on public.albums for delete using (true);

-- Pages Policies
drop policy if exists "Allow anon read pages" on public.pages;
drop policy if exists "Allow anon insert pages" on public.pages;
drop policy if exists "Allow anon update pages" on public.pages;
drop policy if exists "Allow anon delete pages" on public.pages;

create policy "Allow anon read pages" on public.pages for select using (true);
create policy "Allow anon insert pages" on public.pages for insert with check (true);
create policy "Allow anon update pages" on public.pages for update using (true);
create policy "Allow anon delete pages" on public.pages for delete using (true);

-- Vocab Notes Policies
drop policy if exists "Allow anon read vocab_notes" on public.vocab_notes;
drop policy if exists "Allow anon insert vocab_notes" on public.vocab_notes;
drop policy if exists "Allow anon update vocab_notes" on public.vocab_notes;
drop policy if exists "Allow anon delete vocab_notes" on public.vocab_notes;

create policy "Allow anon read vocab_notes" on public.vocab_notes for select using (true);
create policy "Allow anon insert vocab_notes" on public.vocab_notes for insert with check (true);
create policy "Allow anon update vocab_notes" on public.vocab_notes for update using (true);
create policy "Allow anon delete vocab_notes" on public.vocab_notes for delete using (true);

-- ==============================================================================
-- 5. TẠO STORAGE BUCKET LƯU ẢNH TRANG SÁCH & ẢNH BÌA: 'book-images'
-- ==============================================================================

insert into storage.buckets (id, name, public)
values ('book-images', 'book-images', true)
on conflict (id) do update set public = true;

-- Cấp quyền truy cập công khai cho bucket book-images
drop policy if exists "Public Access book-images" on storage.objects;
drop policy if exists "Anon Upload book-images" on storage.objects;
drop policy if exists "Anon Update book-images" on storage.objects;
drop policy if exists "Anon Delete book-images" on storage.objects;

create policy "Public Access book-images"
  on storage.objects for select
  using ( bucket_id = 'book-images' );

create policy "Anon Upload book-images"
  on storage.objects for insert
  with check ( bucket_id = 'book-images' );

create policy "Anon Update book-images"
  on storage.objects for update
  using ( bucket_id = 'book-images' );

create policy "Anon Delete book-images"
  on storage.objects for delete
  using ( bucket_id = 'book-images' );
