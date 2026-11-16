-- Demo money for the demo account (demo@folium.test). DEV ONLY.
--
-- Run it with `bun run db:seed:finance` (scripts/seed-finance.mjs checks the
-- target is the local stack first). It is deliberately NOT in config.toml's
-- seed paths, so `db reset`, tests and CI never load it.
--
-- Idempotent: it deletes the demo account's accounts, categories and
-- transactions and rebuilds them. About 40 transactions over the last 60 days,
-- dated relative to today in Asia/Makassar.

do $$
declare
  v_user uuid := 'de300000-0000-4000-8000-000000000001';
  v_today date := (now() at time zone 'Asia/Makassar')::date;
  a_livin uuid; a_dana uuid; a_gopay uuid; a_cash uuid; a_save uuid;
  c_food uuid; c_coffee uuid; c_transport uuid; c_kos uuid; c_ukt uuid; c_subs uuid; c_shop uuid;
  c_health uuid; c_fun uuid; c_allow uuid; c_scholar uuid; c_part uuid;
begin
  if not exists (select 1 from auth.users where id = v_user) then
    raise exception 'The demo user is missing: run `bun run db:seed` first.';
  end if;

  delete from public.transactions where user_id = v_user;
  delete from public.import_batches where user_id = v_user;
  delete from public.recurring_rules where user_id = v_user;
  delete from public.budgets where user_id = v_user;
  delete from public.goals where user_id = v_user;
  delete from public.people where user_id = v_user;
  delete from public.categories where user_id = v_user and parent_id is not null;
  delete from public.categories where user_id = v_user;
  delete from public.accounts where user_id = v_user;

  insert into public.accounts (user_id, name, type, color, icon, sort_order, opening_balance) values
    (v_user, 'Livin'' by Mandiri', 'bank',    '#1971c2', 'landmark',   1, 1250000) returning id into a_livin;
  insert into public.accounts (user_id, name, type, color, icon, sort_order, opening_balance) values
    (v_user, 'DANA',               'ewallet', '#364fc7', 'wallet',     2, 85000) returning id into a_dana;
  insert into public.accounts (user_id, name, type, color, icon, sort_order, opening_balance) values
    (v_user, 'GoPay',              'ewallet', '#087f5b', 'smartphone', 3, 40000) returning id into a_gopay;
  insert into public.accounts (user_id, name, type, color, icon, sort_order, opening_balance) values
    (v_user, 'Cash',               'cash',    '#5c940d', 'banknote',   4, 150000) returning id into a_cash;
  insert into public.accounts (user_id, name, type, color, icon, sort_order, opening_balance) values
    (v_user, 'Tabungan',           'savings', '#862e9c', 'piggy-bank', 5, 2000000) returning id into a_save;

  insert into public.categories (user_id, name, kind, color, icon, sort_order) values
    (v_user, 'Food', 'expense', '#d97706', 'utensils', 1) returning id into c_food;
  insert into public.categories (user_id, name, kind, color, icon, sort_order, parent_id) values
    (v_user, 'Coffee', 'expense', '#d9480f', 'coffee', 1, c_food) returning id into c_coffee;
  insert into public.categories (user_id, name, kind, color, icon, sort_order) values
    (v_user, 'Transport', 'expense', '#1971c2', 'bus', 2) returning id into c_transport;
  insert into public.categories (user_id, name, kind, color, icon, sort_order) values
    (v_user, 'Kos/Rent', 'expense', '#5f3dc4', 'house', 3) returning id into c_kos;
  insert into public.categories (user_id, name, kind, color, icon, sort_order) values
    (v_user, 'Tuition (UKT)', 'expense', '#c92a2a', 'graduation-cap', 4) returning id into c_ukt;
  insert into public.categories (user_id, name, kind, color, icon, sort_order) values
    (v_user, 'Subscriptions', 'expense', '#a61e4d', 'repeat', 5) returning id into c_subs;
  insert into public.categories (user_id, name, kind, color, icon, sort_order) values
    (v_user, 'Shopping', 'expense', '#862e9c', 'shopping-bag', 6) returning id into c_shop;
  insert into public.categories (user_id, name, kind, color, icon, sort_order) values
    (v_user, 'Health', 'expense', '#2b8a3e', 'heart-pulse', 7) returning id into c_health;
  insert into public.categories (user_id, name, kind, color, icon, sort_order) values
    (v_user, 'Entertainment', 'expense', '#0c8599', 'clapperboard', 8) returning id into c_fun;
  insert into public.categories (user_id, name, kind, color, icon, sort_order) values
    (v_user, 'Other', 'expense', '#495057', null, 9);
  insert into public.categories (user_id, name, kind, color, icon, sort_order) values
    (v_user, 'Allowance', 'income', '#2b8a3e', 'hand-coins', 1) returning id into c_allow;
  insert into public.categories (user_id, name, kind, color, icon, sort_order) values
    (v_user, 'Scholarship', 'income', '#1971c2', 'award', 2) returning id into c_scholar;
  insert into public.categories (user_id, name, kind, color, icon, sort_order) values
    (v_user, 'Part-time', 'income', '#d97706', 'briefcase', 3) returning id into c_part;
  insert into public.categories (user_id, name, kind, color, icon, sort_order) values
    (v_user, 'Other', 'income', '#495057', null, 4);

  -- (kind, amount, account, category, payee, days ago, status, to account, fee, direction, note)
  insert into public.transactions
    (user_id, kind, amount, account_id, category_id, payee, occurred_on, status, to_account_id, fee_amount, adjustment_direction, note)
  select v_user, t.kind, t.amount, t.account, t.category, t.payee, v_today - t.days_ago,
         coalesce(t.status, 'posted'), t.to_account, coalesce(t.fee, 0), t.direction, t.note
  from (values
    -- Income
    ('income',  1500000, a_livin, c_allow,   'Mama',            58, null, null::uuid, null::int, null, 'Uang saku bulanan'),
    ('income',  1500000, a_livin, c_allow,   'Mama',            28, null, null, null, null, 'Uang saku bulanan'),
    ('income',  2400000, a_livin, c_scholar, 'Beasiswa KIP',    45, null, null, null, null, null),
    ('income',   350000, a_gopay, c_part,    'Les privat',      20, null, null, null, null, 'Ngajar matematika SMP'),
    ('income',   350000, a_gopay, c_part,    'Les privat',       6, null, null, null, null, 'Ngajar matematika SMP'),
    ('income',  1500000, a_livin, c_allow,   'Mama',            -2, 'planned', null, null, null, 'Uang saku bulanan'),
    -- Fixed costs
    ('expense',  900000, a_livin, c_kos,     'Ibu kos',         57, null, null, null, null, 'Kos Oktober'),
    ('expense',  900000, a_livin, c_kos,     'Ibu kos',         27, null, null, null, null, 'Kos November'),
    ('expense', 2400000, a_livin, c_ukt,     'UKT Semester Ganjil', 44, null, null, null, null, null),
    ('expense',   54990, a_dana,  c_subs,    'Spotify',         40, null, null, null, null, null),
    ('expense',   54990, a_dana,  c_subs,    'Spotify',         10, null, null, null, null, null),
    ('expense',   65000, a_livin, c_subs,    'Netflix',         12, null, null, null, null, null),
    ('expense',   54990, a_dana,  c_subs,    'Spotify',        -20, 'planned', null, null, null, null),
    -- Food and coffee
    ('expense',    32500, a_gopay, c_food,   'GoFood',           0, null, null, null, null, 'Ayam geprek'),
    ('expense',    18000, a_cash,  c_coffee, 'Kopi Kenangan',    1, null, null, null, null, null),
    ('expense',    45000, a_gopay, c_food,   'GoFood',           2, null, null, null, null, null),
    ('expense',    15000, a_cash,  c_food,   'Warteg',           3, null, null, null, null, null),
    ('expense',    27000, a_dana,  c_coffee, 'Janji Jiwa',       5, null, null, null, null, null),
    ('expense',    38000, a_gopay, c_food,   'GoFood',           8, null, null, null, null, null),
    ('expense',    12000, a_cash,  c_food,   'Kantin FT',        9, null, null, null, null, null),
    ('expense',    52000, a_gopay, c_food,   'GrabFood',        15, null, null, null, null, 'Makan bareng kelompok'),
    ('expense',    14000, a_cash,  c_food,   'Kantin FT',       22, null, null, null, null, null),
    ('expense',    36000, a_gopay, c_food,   'GoFood',          33, null, null, null, null, null),
    ('expense',    21000, a_cash,  c_coffee, 'Kopi Kenangan',   36, null, null, null, null, null),
    ('expense',    41000, a_gopay, c_food,   'GrabFood',        50, null, null, null, null, null),
    -- Transport
    ('expense',    14000, a_gopay, c_transport, 'Grab',          1, null, null, null, null, 'Ke kampus'),
    ('expense',    22000, a_gopay, c_transport, 'Gojek',         4, null, null, null, null, null),
    ('expense',    18000, a_gopay, c_transport, 'Grab',         18, null, null, null, null, null),
    ('expense',    50000, a_cash,  c_transport, 'Bensin',       24, null, null, null, null, null),
    ('expense',    16000, a_gopay, c_transport, 'Grab',         47, null, null, null, null, null),
    -- Other spending
    ('expense',   125000, a_dana,  c_shop,   'Shopee',          11, null, null, null, null, 'Flashdisk + casing'),
    ('expense',    47000, a_cash,  c_health, 'Apotek K-24',     26, null, null, null, null, null),
    ('expense',    50000, a_dana,  c_fun,    'XXI',             13, null, null, null, null, null),
    ('expense',    85000, a_dana,  c_shop,   'Tokopedia',       39, null, null, null, null, 'Buku kalkulus bekas'),
    -- Transfers (one with a fee) and an adjustment
    ('transfer',  200000, a_livin, null,     null,               7, null, a_gopay, 0, null, 'Top up GoPay'),
    ('transfer',  150000, a_livin, null,     null,              21, null, a_dana, 2500, null, 'Top up DANA'),
    ('transfer',  300000, a_livin, null,     null,              29, null, a_cash, 0, null, 'Tarik tunai'),
    ('transfer',  500000, a_livin, null,     null,              55, null, a_save, 0, null, 'Nabung'),
    ('adjustment',  6500, a_cash,  null,     null,              16, null, null, null, 'out', 'Uang receh hilang')
  ) as t(kind, amount, account, category, payee, days_ago, status, to_account, fee, direction, note);

  -- Phase 2: recurring rules (the app generates their planned rows on the next visit),
  -- budgets for this month, a savings goal and a couple of debts.
  insert into public.recurring_rules (user_id, name, kind, amount, account_id, category_id, cadence, due_day, starts_on, remind_days_before, is_estimate, instalments_total, to_account_id) values
    (v_user, 'Kos',       'expense',  900000, a_livin, c_kos,    'monthly', 1,  date_trunc('month', v_today)::date, 5, false, null, null),
    (v_user, 'Spotify',   'expense',   54990, a_dana,  c_subs,   'monthly', 20, v_today - 40, 3, false, null, null),
    (v_user, 'Netflix',   'expense',   65000, a_livin, c_subs,   'monthly', 18, v_today - 40, 3, false, null, null),
    (v_user, 'Data XL',   'expense',   75000, a_gopay, c_shop,   'monthly', 25, v_today - 40, 3, true,  null, null),
    (v_user, 'UKT Genap', 'expense', 1200000, a_livin, c_ukt,    'monthly', 10, v_today,      7, false, 4,    null),
    (v_user, 'Allowance', 'income',  1500000, a_livin, c_allow,  'monthly', 28, v_today - 40, 0, false, null, null);
  insert into public.recurring_rules (user_id, name, kind, amount, account_id, to_account_id, cadence, due_day, starts_on, remind_days_before) values
    (v_user, 'Nabung bulanan', 'transfer', 300000, a_livin, a_save, 'monthly', 2, v_today, 0);

  insert into public.budgets (user_id, category_id, month, amount, rollover) values
    (v_user, c_food,      date_trunc('month', v_today)::date, 600000, true),
    (v_user, c_transport, date_trunc('month', v_today)::date, 150000, false),
    (v_user, c_subs,      date_trunc('month', v_today)::date, 120000, false),
    (v_user, c_shop,      date_trunc('month', v_today)::date, 100000, false);

  insert into public.goals (user_id, name, target_amount, target_on, account_id) values
    (v_user, 'Laptop baru', 8000000, (v_today + 240), a_save);

  insert into public.people (user_id, name) values (v_user, 'Budi'), (v_user, 'Sari');
  insert into public.transactions (user_id, kind, amount, account_id, person_id, occurred_on, note)
  select v_user, t.kind, t.amount, a_gopay, p.id, v_today - t.days_ago, t.note
  from (values
    ('lend',    45000, 'Budi', 6, 'Patungan pizza'),
    ('borrow',  20000, 'Sari', 3, 'Fotokopi modul'),
    ('lend',    30000, 'Sari', 9, 'Tiket bioskop'),
    ('repay',   30000, 'Sari', 2, null)
  ) as t(kind, amount, name, days_ago, note)
  join public.people p on p.user_id = v_user and p.name = t.name;
end;
$$;
