-- admin_get_users: expõe emails de auth.users apenas para admins
-- SECURITY DEFINER necessário pois auth.users não é acessível via RLS de role anon/authenticated.
-- A verificação de papel admin é feita dentro da função.

create or replace function public.admin_get_users()
returns table(
  id         uuid,
  name       text,
  email      text,
  role       text,
  active     boolean,
  store_id   uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Garante que apenas admins podem chamar esta função
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ) then
    raise exception 'Acesso negado.' using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      p.id,
      p.name,
      au.email,
      p.role,
      p.active,
      p.store_id,
      p.created_at
    from public.profiles p
    join auth.users au on au.id = p.id
    order by p.created_at desc;
end;
$$;

-- Revoga acesso público; apenas usuários autenticados chamam (a função verifica o papel internamente)
revoke all on function public.admin_get_users() from public, anon;
grant execute on function public.admin_get_users() to authenticated;
