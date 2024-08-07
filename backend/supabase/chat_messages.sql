-- This file is autogenerated from regen-schema.ts
create table if not exists
  chat_messages (
    id integer not null,
    user_id text not null,
    channel_id text not null,
    content jsonb not null,
    created_time timestamp with time zone default now() not null
  );

-- Policies
alter table chat_messages enable row level security;

drop policy if exists "public read" on chat_messages;

create policy "public read" on chat_messages for
select
  using (true);

-- Indexes
drop index if exists chat_messages_pkey;

create unique index chat_messages_pkey on public.chat_messages using btree (id);

drop index if exists chat_messages_channel_id;

create index chat_messages_channel_id on public.chat_messages using btree (channel_id, id desc);
