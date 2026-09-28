-- Limites mensuelles par plan (gratuit / Pro / Ultra Pro) + limite de la
-- saisie manuelle des dépenses pour le plan gratuit.
--
--                     Gratuit   Pro    Ultra Pro
--   dépenses manuelles   15      ∞        ∞
--   scans de reçus        5      30       ∞
--   saisies vocales       5      30       ∞
--   messages assistant   10      ∞        ∞
--   suggestions budget    2      ∞        ∞
--   plans de budget       1      ∞        ∞
--   score financier       1      ∞        ∞
--
-- Les compteurs repartent à zéro le 1er de chaque mois (table feature_usage).
-- Les données existantes ne sont jamais touchées : seules les nouvelles
-- créations au-delà du quota sont refusées.

-- ─────────────────────────────────────────────────────────────
-- 1. Origine de chaque transaction
--    Seules les dépenses saisies à la main comptent dans la limite de 15.
--    Les autres origines ont leur propre quota (scan, voix, assistant) ou
--    ne sont pas des dépenses du quotidien (virements, épargne, onboarding).
-- ─────────────────────────────────────────────────────────────
alter table public.transactions
  add column if not exists source text not null default 'manual';

alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions
  add constraint transactions_source_check
  check (source in ('manual', 'voice', 'scan', 'assistant', 'transfer', 'onboarding', 'recurring', 'import'));

comment on column public.transactions.source is
  'Origine : manual (saisie à la main), voice, scan, assistant, transfer (entre portefeuilles / épargne), onboarding, recurring, import.';

-- ─────────────────────────────────────────────────────────────
-- 2. Plan de l'utilisateur : free | pro | ultra
--    Même règle d'activité que has_active_pro (période de grâce comprise).
--    Les administrateurs ne sont jamais limités.
-- ─────────────────────────────────────────────────────────────
create or replace function public.user_plan(_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when public.has_role(_user_id, 'admin') then 'ultra' else coalesce(
    (select case
              when s.plan_name in ('Ultra Pro', 'Pro Max', 'Max') then 'ultra'
              else 'pro'
            end
       from public.subscriptions s
      where s.user_id = _user_id
        and s.status = 'active'
        and coalesce(s.grace_until, s.expires_at) > now()
      order by s.updated_at desc nulls last
      limit 1),
    'free') end;
$$;

grant execute on function public.user_plan(uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 3. Source unique des limites. NULL = pas de limite.
-- ─────────────────────────────────────────────────────────────
create or replace function public.plan_limit(_feature text, _plan text)
returns integer language sql immutable as $$
  select case _plan
    when 'ultra' then null
    when 'pro' then case _feature
      when 'scan'  then 30
      when 'voice' then 30
      else null
    end
    else case _feature
      when 'manual_expense'  then 15
      when 'scan'            then 5
      when 'voice'           then 5
      when 'chat'            then 10
      when 'budget_suggest'  then 2
      when 'budget_plan'     then 1
      when 'financial_score' then 1
      else null
    end
  end;
$$;

-- Conservée pour compatibilité : limites du plan gratuit.
create or replace function public.free_limit(_feature text)
returns integer language sql immutable as $$
  select public.plan_limit(_feature, 'free');
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Consommation atomique d'un crédit mensuel, selon le plan
-- ─────────────────────────────────────────────────────────────
create or replace function public.consume_feature(_user_id uuid, _feature text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', now())::date;
  v_plan text := public.user_plan(_user_id);
  v_limit integer := public.plan_limit(_feature, v_plan);
  v_used integer;
  v_resets timestamptz := (date_trunc('month', now()) + interval '1 month');
begin
  -- Un utilisateur connecté ne peut consommer que pour lui-même
  if auth.uid() is not null and auth.uid() <> _user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Pas de limite pour ce plan : on compte sans jamais bloquer
  if v_limit is null then
    insert into public.feature_usage (user_id, feature, month, used, updated_at)
    values (_user_id, _feature, v_month, 1, now())
    on conflict (user_id, feature, month)
      do update set used = public.feature_usage.used + 1, updated_at = now()
    returning used into v_used;
    return jsonb_build_object('allowed', true, 'unlimited', true, 'used', v_used,
                              'limit', null, 'resets_at', v_resets, 'plan', v_plan);
  end if;

  -- Plan limité : on n'incrémente que si le quota n'est pas atteint
  insert into public.feature_usage (user_id, feature, month, used, updated_at)
  values (_user_id, _feature, v_month, 1, now())
  on conflict (user_id, feature, month)
    do update set used = public.feature_usage.used + 1, updated_at = now()
    where public.feature_usage.used < v_limit
  returning used into v_used;

  if v_used is null then
    select used into v_used from public.feature_usage
    where user_id = _user_id and feature = _feature and month = v_month;
    return jsonb_build_object('allowed', false, 'unlimited', false,
                              'used', coalesce(v_used, v_limit), 'limit', v_limit,
                              'resets_at', v_resets, 'plan', v_plan);
  end if;

  return jsonb_build_object('allowed', true, 'unlimited', false, 'used', v_used,
                            'limit', v_limit, 'resets_at', v_resets, 'plan', v_plan);
end;
$$;

revoke all on function public.consume_feature(uuid, text) from public, anon;
grant execute on function public.consume_feature(uuid, text) to service_role, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. Compteurs du mois pour l'affichage.
--    Colonnes inchangées (l'app les lit déjà) : free_limit contient
--    désormais la limite du plan de l'utilisateur, unlimited = pas de limite.
-- ─────────────────────────────────────────────────────────────
create or replace function public.monthly_usage(_user_id uuid default auth.uid())
returns table (feature text, used integer, free_limit integer, unlimited boolean, resets_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := public.user_plan(_user_id);
begin
  if auth.uid() is not null and auth.uid() <> _user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select f.feature,
         coalesce(u.used, 0)::integer,
         public.plan_limit(f.feature, v_plan),
         public.plan_limit(f.feature, v_plan) is null,
         (date_trunc('month', now()) + interval '1 month')
  from (values ('manual_expense'), ('scan'), ('chat'), ('voice'),
               ('budget_suggest'), ('budget_plan'), ('financial_score')) as f(feature)
  left join public.feature_usage u
    on u.user_id = _user_id and u.feature = f.feature
   and u.month = date_trunc('month', now())::date;
end;
$$;

revoke all on function public.monthly_usage(uuid) from public, anon;
grant execute on function public.monthly_usage(uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 6. Limite des dépenses saisies à la main (plan gratuit : 15 / mois)
--    Le quota est décompté pour la personne qui saisit (auth.uid()), ce qui
--    fonctionne aussi dans un espace partagé où user_id est le propriétaire.
-- ─────────────────────────────────────────────────────────────
create or replace function public.enforce_manual_expense_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.user_id);
  v_result jsonb;
begin
  if new.type is distinct from 'expense' or coalesce(new.source, 'manual') <> 'manual' then
    return new;
  end if;

  if public.has_role(v_actor, 'admin') then
    return new;
  end if;

  v_result := public.consume_feature(v_actor, 'manual_expense');

  if (v_result->>'allowed')::boolean is not true then
    raise exception 'free_plan_limit_reached: manual_expense (limite %/mois)', (v_result->>'limit')
      using errcode = 'P0001',
            hint = 'Passe au plan Pro pour continuer ce mois-ci.',
            detail = v_result::text;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_quota_manual_expense on public.transactions;
create trigger trg_quota_manual_expense
  before insert on public.transactions
  for each row execute function public.enforce_manual_expense_quota();

-- ─────────────────────────────────────────────────────────────
-- 7. Fin du double décompte des scans et des messages à l'assistant
--    L'app consomme déjà un crédit AVANT l'appel à l'IA (consume_feature).
--    Les déclencheurs posés le 22/09 en consommaient un second au moment de
--    l'enregistrement : chaque scan comptait double (≈ 2 à 3 scans au lieu
--    de 5) et chaque message aussi (≈ 5 au lieu de 10).
--    Pour scan et chat, le déclencheur ne fait désormais que VÉRIFIER que le
--    compteur du mois ne dépasse pas la limite du plan. Le score financier,
--    qui n'est pas décompté par l'app, continue d'être consommé ici.
-- ─────────────────────────────────────────────────────────────
create or replace function public.enforce_feature_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feature text := tg_argv[0];
  v_plan text;
  v_limit integer;
  v_used integer;
  v_result jsonb;
begin
  -- Seuls les messages écrits par l'utilisateur comptent (pas les réponses de l'IA).
  -- Le test est imbriqué : le champ message_role n'existe que sur cette table.
  if tg_table_name = 'assistant_messages' then
    if coalesce(new.message_role, '') <> 'user' then
      return new;
    end if;
  end if;

  if public.has_role(new.user_id, 'admin') then
    return new;
  end if;

  if v_feature in ('scan', 'chat') then
    -- Crédit déjà consommé par l'app : simple vérification.
    v_plan := public.user_plan(new.user_id);
    v_limit := public.plan_limit(v_feature, v_plan);
    if v_limit is null then
      return new;
    end if;
    select used into v_used from public.feature_usage
     where user_id = new.user_id and feature = v_feature
       and month = date_trunc('month', now())::date;
    if coalesce(v_used, 0) <= v_limit then
      return new;
    end if;
    v_result := jsonb_build_object('allowed', false, 'unlimited', false,
                                   'used', v_used, 'limit', v_limit,
                                   'resets_at', date_trunc('month', now()) + interval '1 month',
                                   'plan', v_plan);
  else
    v_result := public.consume_feature(new.user_id, v_feature);
    if (v_result->>'allowed')::boolean is true then
      return new;
    end if;
  end if;

  raise exception 'free_plan_limit_reached: % (limite %/mois)', v_feature, (v_result->>'limit')
    using errcode = 'P0001',
          hint = 'Passe au plan supérieur pour continuer ce mois-ci.',
          detail = v_result::text;
end;
$$;
