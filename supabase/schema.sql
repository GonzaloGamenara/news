-- Titular — esquema de sincronización.
-- Pegar y ejecutar en el SQL Editor de Supabase.

create table if not exists public.profiles (
  -- Identificador del dispositivo: un UUID aleatorio que genera el cliente.
  -- Funciona como credencial, así que nunca se muestra en URLs ni se loguea.
  device_id  uuid primary key,
  -- El perfil del algoritmo + las preferencias, tal cual viven en el cliente.
  data       jsonb       not null,
  -- Reloj del cliente. Resuelve conflictos: gana la escritura más nueva.
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- RLS prendido y SIN políticas: nadie puede tocar esta tabla con la clave
-- publicable. El único acceso es vía /api/sync, que corre en el servidor con la
-- secret key (service_role la saltea). Así el device_id nunca sale del backend
-- hacia otra cosa que no sea el propio dispositivo.
alter table public.profiles enable row level security;

create index if not exists profiles_updated_at_idx on public.profiles (updated_at desc);
