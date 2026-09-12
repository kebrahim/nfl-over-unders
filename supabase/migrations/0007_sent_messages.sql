-- Audit trail of outbound texts (recap/preview generations, connectivity
-- tests) — otherwise the only record of what got sent, and when, is
-- whoever's actual phone. Writes happen only from server code via the
-- service role (sendGroupText/sendDirectText in src/lib/notify/sms.ts),
-- so there's no insert/update/delete policy for regular authenticated
-- users — only a read policy for the commissioner, to show on /admin.
create table sent_messages (
  id bigint generated always as identity primary key,
  kind text not null,
  target text not null check (target in ('self', 'group')),
  week integer,
  message text not null,
  sent_at timestamptz not null default now()
);

alter table sent_messages enable row level security;

create policy "commissioner can view sent messages"
  on sent_messages for select to authenticated using (is_commissioner());
