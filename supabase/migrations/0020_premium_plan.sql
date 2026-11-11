-- 0020 — Plano premium: o plano só muda pelo servidor
-- CareerOS · documento 10 §4.3 (user_limits)
--
-- user_limits foi criada com a política de UPDATE "do próprio dono" (apply_owner_rls). Como o plano
-- passa a liberar recursos pagos, deixar o usuário gravar a própria linha permitiria a ele se
-- promover a premium pela API. A partir daqui o usuário só LÊ user_limits; quem altera é o
-- service_role (webhook de pagamento ou operação manual), que ignora RLS e privilégios de coluna.

alter table public.user_limits
  drop constraint if exists user_limits_plan_chk;
alter table public.user_limits
  add constraint user_limits_plan_chk check (plan in ('personal', 'premium'));

revoke insert, update, delete on public.user_limits from authenticated, anon;

drop policy if exists user_limits_insert_own on public.user_limits;
drop policy if exists user_limits_update_own on public.user_limits;
drop policy if exists user_limits_delete_own on public.user_limits;

comment on column public.user_limits.plan is
  'personal | premium. Somente o service_role altera (RLS e REVOKE impedem a autopromoção).';
