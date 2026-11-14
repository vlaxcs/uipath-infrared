create extension if not exists postgis;

create table site_options (
  id              bigint generated always as identity primary key,
  kind            text not null check (kind in ('colocation', 'lease')),
  label           text not null,
  location        geography(point, 4326) not null,
  area_m2         numeric check (area_m2 > 0),
  racks           integer check (racks > 0),
  rent_eur_month  numeric not null check (rent_eur_month >= 0),
  currency        text not null,
  rent_original   numeric not null check (rent_original >= 0),
  source_url      text not null unique,
  read_at         timestamptz not null,
  gone_at         timestamptz,
  check ((kind = 'lease' and area_m2 is not null) or (kind = 'colocation' and racks is not null))
);

create index site_options_location on site_options using gist (location);
create index site_options_kind_read_at on site_options (kind, read_at);

do $$
begin
  if not exists (select from pg_roles where rolname = 'site_step') then
    create role site_step nologin;
  end if;
end
$$;

revoke all on site_options from public;
grant select, insert, update on site_options to site_step;
