-- Nom Cloud's default school week is Saturday-Wednesday.
-- Thursday remains available by removing it from weekend_days for schools that
-- operate a six-day week.

alter table public.schools
  alter column weekend_days set default '{4,5}'::smallint[];

update public.schools
set weekend_days = '{4,5}'::smallint[]
where weekend_days = '{5,6}'::smallint[];
