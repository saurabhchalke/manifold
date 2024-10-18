-- This file is autogenerated from regen-schema.ts
create table if not exists
  redemption_status (
    id bigint primary key generated always as identity not null,
    created_time timestamp with time zone default now() not null,
    user_id text not null,
    status text not null,
    session_id text not null,
    transaction_id text not null,
    txn_id text not null
  );

-- Foreign Keys
alter table redemption_status
add constraint redemption_status_user_id_fkey foreign key (user_id) references users (id);

-- Row Level Security
alter table redemption_status enable row level security;