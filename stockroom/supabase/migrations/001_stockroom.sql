create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  category text not null,
  image_url text,
  price numeric(12,2) not null check (price >= 0),
  discount_price numeric(12,2) check (discount_price is null or (discount_price >= 0 and discount_price < price)),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory (
  product_id uuid primary key references public.products(id) on delete restrict,
  physical_stock integer not null default 0 check (physical_stock >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  public_order_code varchar(20) not null unique,
  status text not null default 'pending' check (status in ('pending','paid','cancelled','expired')),
  pricing_strategy text not null check (pricing_strategy in ('regular','discount')),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  total numeric(12,2) not null check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name_snapshot text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0 and quantity <= 99),
  line_total numeric(12,2) not null check (line_total >= 0),
  unique (order_id, product_id)
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  status text not null default 'active' check (status in ('active','consumed','released','expired')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null
);

create table if not exists public.reservation_items (
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0 and quantity <= 99),
  primary key (reservation_id, product_id)
);

create index if not exists idx_products_category_active on public.products(category, is_active);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_reservations_status_expiry on public.reservations(status, expires_at);
create index if not exists idx_reservation_items_product on public.reservation_items(product_id);
create index if not exists idx_order_items_order on public.order_items(order_id);

create or replace function public.create_order_and_reserve(p_items jsonb, p_pricing_strategy text)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_product public.products%rowtype;
  v_stock public.inventory%rowtype;
  v_reserved integer;
  v_available integer;
  v_price numeric(12,2);
  v_total numeric(12,2) := 0;
  v_order_id uuid;
  v_reservation_id uuid;
  v_order_code varchar(20);
  v_expires_at timestamptz;
  v_now timestamptz;
begin
  if p_pricing_strategy not in ('regular','discount') or p_pricing_strategy is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_strategy');
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_order');
  end if;
  if jsonb_array_length(p_items) > 50 then
    return jsonb_build_object('ok', false, 'error', 'invalid_quantity');
  end if;

  -- Lock product and inventory rows in the same deterministic order for every order.
  for v_item in
    select x.product_id, sum(x.quantity)::integer as quantity
    from (
      select (e.value->>'product_id')::uuid as product_id,
             (e.value->>'quantity')::integer as quantity
      from jsonb_array_elements(p_items) e(value)
    ) x
    group by x.product_id
    order by x.product_id
  loop
    if v_item.quantity < 1 or v_item.quantity > 99 then
      return jsonb_build_object('ok', false, 'error', 'invalid_quantity');
    end if;
    select p.* into v_product
    from public.products p
    join public.inventory i on i.product_id = p.id
    where p.id = v_item.product_id and p.is_active = true
    for update of p;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'product_unavailable');
    end if;
    select i.* into v_stock from public.inventory i where i.product_id = v_item.product_id for update;
    v_now := clock_timestamp();
    select coalesce(sum(ri.quantity), 0)::integer into v_reserved
    from public.reservation_items ri
    join public.reservations r on r.id = ri.reservation_id
    where ri.product_id = v_item.product_id
      and r.status = 'active'
      and r.expires_at > v_now;
    v_available := v_stock.physical_stock - v_reserved;
    if v_available < v_item.quantity then
      return jsonb_build_object('ok', false, 'error', 'insufficient_stock', 'product_id', v_item.product_id);
    end if;
  end loop;

  -- Price snapshots are calculated only from database values.
  for v_item in
    select x.product_id, sum(x.quantity)::integer as quantity
    from (
      select (e.value->>'product_id')::uuid as product_id,
             (e.value->>'quantity')::integer as quantity
      from jsonb_array_elements(p_items) e(value)
    ) x
    group by x.product_id order by x.product_id
  loop
    select p.* into v_product from public.products p where p.id = v_item.product_id;
    if p_pricing_strategy = 'discount' and v_product.discount_price is not null and v_product.discount_price < v_product.price then
      v_price := v_product.discount_price;
    else
      v_price := v_product.price;
    end if;
    v_total := v_total + v_price * v_item.quantity;
  end loop;

  v_order_code := upper(substr(encode(gen_random_bytes(16), 'hex'), 1, 20));
  insert into public.orders(public_order_code, status, pricing_strategy, subtotal, total)
  values (v_order_code, 'pending', p_pricing_strategy, v_total, v_total)
  returning id into v_order_id;

  insert into public.reservations(order_id, status, created_at, expires_at)
  values (v_order_id, 'active', clock_timestamp(), clock_timestamp() + interval '10 minutes')
  returning id, expires_at into v_reservation_id, v_expires_at;

  for v_item in
    select x.product_id, sum(x.quantity)::integer as quantity
    from (
      select (e.value->>'product_id')::uuid as product_id,
             (e.value->>'quantity')::integer as quantity
      from jsonb_array_elements(p_items) e(value)
    ) x
    group by x.product_id order by x.product_id
  loop
    select p.* into v_product from public.products p where p.id = v_item.product_id;
    if p_pricing_strategy = 'discount' and v_product.discount_price is not null and v_product.discount_price < v_product.price then
      v_price := v_product.discount_price;
    else
      v_price := v_product.price;
    end if;
    insert into public.order_items(order_id, product_id, product_name_snapshot, unit_price, quantity, line_total)
    values (v_order_id, v_item.product_id, v_product.name, v_price, v_item.quantity, v_price * v_item.quantity);
    insert into public.reservation_items(reservation_id, product_id, quantity)
    values (v_reservation_id, v_item.product_id, v_item.quantity);
  end loop;

  return jsonb_build_object('ok', true, 'order_code', v_order_code, 'expires_at', v_expires_at);
exception
  when data_exception then
    return jsonb_build_object('ok', false, 'error', 'invalid_quantity');
end;
$$;

create or replace function public.pay_order(p_order_code text)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_reservation public.reservations%rowtype;
  v_item record;
  v_now timestamptz;
begin
  select * into v_order from public.orders where public_order_code = upper(p_order_code) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'order_not_found'); end if;
  if v_order.status = 'paid' then return jsonb_build_object('ok', true, 'already_paid', true); end if;
  if v_order.status = 'cancelled' then return jsonb_build_object('ok', false, 'error', 'order_cancelled'); end if;
  if v_order.status = 'expired' then return jsonb_build_object('ok', false, 'error', 'reservation_expired'); end if;

  select * into v_reservation from public.reservations where order_id = v_order.id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'reservation_missing'); end if;
  v_now := clock_timestamp();
  if v_reservation.status <> 'active' or v_reservation.expires_at <= v_now then
    if v_reservation.status = 'active' then update public.reservations set status = 'expired' where id = v_reservation.id; end if;
    update public.orders set status = 'expired', updated_at = clock_timestamp() where id = v_order.id;
    return jsonb_build_object('ok', false, 'error', 'reservation_expired');
  end if;

  -- Same lock ordering as reservation creation; the order row serializes duplicate payments.
  for v_item in select product_id, quantity from public.reservation_items where reservation_id = v_reservation.id order by product_id loop
    perform 1 from public.inventory where product_id = v_item.product_id for update;
    if not found then return jsonb_build_object('ok', false, 'error', 'insufficient_stock'); end if;
    if (select physical_stock from public.inventory where product_id = v_item.product_id) < v_item.quantity then
      return jsonb_build_object('ok', false, 'error', 'insufficient_stock');
    end if;
  end loop;

  -- Re-check after waiting for inventory locks: expiry is inclusive at the boundary.
  v_now := clock_timestamp();
  if v_reservation.expires_at <= v_now then
    update public.reservations set status = 'expired' where id = v_reservation.id;
    update public.orders set status = 'expired', updated_at = clock_timestamp() where id = v_order.id;
    return jsonb_build_object('ok', false, 'error', 'reservation_expired');
  end if;

  for v_item in select product_id, quantity from public.reservation_items where reservation_id = v_reservation.id order by product_id loop
    update public.inventory set physical_stock = physical_stock - v_item.quantity, updated_at = clock_timestamp()
    where product_id = v_item.product_id;
  end loop;
  update public.reservations set status = 'consumed' where id = v_reservation.id;
  update public.orders set status = 'paid', updated_at = clock_timestamp() where id = v_order.id;
  return jsonb_build_object('ok', true, 'already_paid', false);
end;
$$;

create or replace function public.cancel_order(p_order_code text)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_reservation public.reservations%rowtype;
begin
  select * into v_order from public.orders where public_order_code = upper(p_order_code) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'order_not_found'); end if;
  if v_order.status = 'paid' then return jsonb_build_object('ok', false, 'error', 'order_paid'); end if;
  if v_order.status = 'cancelled' then return jsonb_build_object('ok', true, 'status', 'cancelled', 'already_cancelled', true); end if;
  if v_order.status = 'expired' then return jsonb_build_object('ok', true, 'status', 'expired', 'already_expired', true); end if;

  select * into v_reservation from public.reservations where order_id = v_order.id for update;
  if not found then
    update public.orders set status = 'cancelled', updated_at = clock_timestamp() where id = v_order.id;
    return jsonb_build_object('ok', true, 'status', 'cancelled');
  end if;
  if v_reservation.status = 'active' and v_reservation.expires_at > clock_timestamp() then
    update public.reservations set status = 'released' where id = v_reservation.id;
    update public.orders set status = 'cancelled', updated_at = clock_timestamp() where id = v_order.id;
    return jsonb_build_object('ok', true, 'status', 'cancelled');
  end if;
  if v_reservation.status = 'active' then update public.reservations set status = 'expired' where id = v_reservation.id; end if;
  update public.orders set status = 'expired', updated_at = clock_timestamp() where id = v_order.id;
  return jsonb_build_object('ok', true, 'status', 'expired');
end;
$$;

-- RLS protects direct table access. The server uses the service-role key only in server routes.
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_items enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products for select to anon, authenticated using (is_active = true);
drop policy if exists "Public can read inventory" on public.inventory;
create policy "Public can read inventory" on public.inventory for select to anon, authenticated using (true);

revoke all on public.orders, public.order_items, public.reservations, public.reservation_items from anon, authenticated;
revoke insert, update, delete on public.products, public.inventory from anon, authenticated;
revoke all on function public.create_order_and_reserve(jsonb, text) from public, anon, authenticated;
revoke all on function public.pay_order(text) from public, anon, authenticated;
revoke all on function public.cancel_order(text) from public, anon, authenticated;
grant execute on function public.create_order_and_reserve(jsonb, text) to service_role;
grant execute on function public.pay_order(text) to service_role;
grant execute on function public.cancel_order(text) to service_role;
