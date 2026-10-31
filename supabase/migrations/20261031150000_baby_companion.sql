-- Bébé Jeton : le petit compagnon que l'utilisateur nourrit en notant ses dépenses.
--
--   • baby_companions        : un bébé par utilisateur (nom, fille/garçon, date de naissance,
--                              rappels « j'ai faim » activés ou non).
--   • baby_feed_days         : journal des repas, une ligne par jour UTC nourri. Rempli
--                              par un déclencheur sur transactions (AFTER INSERT) et jamais
--                              vidé quand une transaction est supprimée : la croissance ne
--                              recule jamais et la faim ne revient pas après une suppression.
--   • get_baby_status()      : état du bébé de l'utilisateur connecté (jours nourris,
--                              dernier repas). 0 ligne s'il n'a pas encore adopté de bébé.
--   • baby_hunger_candidates : liste interne (service_role uniquement) utilisée par la
--                              fonction baby-reminders pour calculer la faim de tous les
--                              bébés en une seule requête.
--   • pg_cron 'baby-reminders' : tous les jours à 12h UTC.
--
-- Règles (identiques partout, lues dans baby_feed_days) :
--   fed_days    = nombre de jours calendaires UTC distincts où l'utilisateur a créé au
--                 moins une transaction depuis la naissance du bébé (même si elle a été
--                 supprimée depuis).
--   last_fed_at = greatest(born_at, dernière transaction créée depuis la naissance,
--                 même supprimée depuis).
--
-- Migration idempotente : peut être rejouée sans erreur ni perte de données.

-- ─────────────────────────────────────────────────────────────
-- 1. Table baby_companions (une ligne par utilisateur)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.baby_companions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'boy',
  born_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 1 à 24 caractères une fois les espaces (et tabulations, retours à la ligne) retirés.
  CONSTRAINT baby_companions_name_check CHECK (
    char_length(btrim(name, E' \t\r\n')) BETWEEN 1 AND 24 AND char_length(name) <= 40
  ),
  CONSTRAINT baby_companions_variant_check CHECK (variant IN ('boy', 'girl'))
);

REVOKE ALL ON public.baby_companions FROM PUBLIC, anon, authenticated;
-- born_at reste fixé par le serveur : le reculer ferait grandir le bébé
-- d'un coup, l'avancer le ferait rapetisser.
GRANT SELECT, DELETE ON public.baby_companions TO authenticated;
GRANT INSERT (user_id, name, variant, notifications_enabled) ON public.baby_companions TO authenticated;
GRANT UPDATE (name, variant, notifications_enabled) ON public.baby_companions TO authenticated;
GRANT ALL ON public.baby_companions TO service_role;

ALTER TABLE public.baby_companions ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur ne voit et ne modifie que son propre bébé.
DROP POLICY IF EXISTS "Users view own baby" ON public.baby_companions;
CREATE POLICY "Users view own baby"
  ON public.baby_companions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create own baby" ON public.baby_companions;
CREATE POLICY "Users create own baby"
  ON public.baby_companions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own baby" ON public.baby_companions;
CREATE POLICY "Users update own baby"
  ON public.baby_companions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own baby" ON public.baby_companions;
CREATE POLICY "Users delete own baby"
  ON public.baby_companions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_baby_companions_updated_at ON public.baby_companions;
CREATE TRIGGER update_baby_companions_updated_at
  BEFORE UPDATE ON public.baby_companions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 2. Journal des repas (ajout seulement) : baby_feed_days
--    Une ligne par bébé et par jour UTC où son propriétaire a créé au moins une
--    transaction depuis la naissance. fed_at = la transaction la plus récente
--    de ce jour (ne recule jamais).
--    Supprimer une transaction (erreur de saisie, doublon d'import Wave…) ne
--    retire rien du journal : le bébé ne rapetisse pas et n'a pas faim à
--    nouveau, sur tous les appareils, et les rappels push suivent la même règle.
--    Les lignes partent avec le bébé (nouvelle adoption = nouveau départ) et
--    avec le compte.
--    Aucun accès client : seuls le déclencheur et les deux fonctions
--    SECURITY DEFINER ci-dessous (et service_role) y touchent.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.baby_feed_days (
  user_id UUID NOT NULL REFERENCES public.baby_companions(user_id) ON DELETE CASCADE,
  day DATE NOT NULL,           -- jour calendaire UTC
  fed_at TIMESTAMPTZ NOT NULL, -- dernière transaction créée ce jour-là
  PRIMARY KEY (user_id, day),
  -- fed_at tombe toujours dans son jour : la ligne du jour le plus récent porte
  -- donc le dernier repas (utilisé par baby_hunger_candidates).
  CONSTRAINT baby_feed_days_day_check CHECK (day = (fed_at AT TIME ZONE 'UTC')::date)
);

REVOKE ALL ON public.baby_feed_days FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.baby_feed_days TO service_role;

-- RLS sans policy + aucun GRANT : invisible et non modifiable par anon / authenticated.
ALTER TABLE public.baby_feed_days ENABLE ROW LEVEL SECURITY;

-- Déclencheur : chaque transaction créée nourrit le bébé de son propriétaire
-- (user_id, comme le reste de l'app : dans un espace partagé, c'est le bébé du
-- propriétaire de l'espace). Une seule requête par instruction INSERT, même
-- pour un import de centaines de lignes.
CREATE OR REPLACE FUNCTION public.baby_record_feed_days()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.baby_feed_days AS d (user_id, day, fed_at)
    SELECT f.user_id, (f.fed_at AT TIME ZONE 'UTC')::date, max(f.fed_at)
      FROM (
        -- Une date de création dans le futur compte pour « maintenant ».
        SELECT n.user_id, LEAST(n.created_at, now()) AS fed_at
          FROM new_rows n
      ) f
      JOIN public.baby_companions b ON b.user_id = f.user_id
     WHERE f.fed_at >= b.born_at
     GROUP BY f.user_id, (f.fed_at AT TIME ZONE 'UTC')::date
     ORDER BY 1, 2
    ON CONFLICT (user_id, day) DO UPDATE
      SET fed_at = EXCLUDED.fed_at
      WHERE d.fed_at < EXCLUDED.fed_at;
  EXCEPTION WHEN OTHERS THEN
    -- Le bébé ne doit jamais empêcher d'enregistrer une transaction.
    RAISE WARNING 'baby_record_feed_days: % (SQLSTATE %)', SQLERRM, SQLSTATE;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.baby_record_feed_days() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_baby_feed_days ON public.transactions;
CREATE TRIGGER trg_baby_feed_days
  AFTER INSERT ON public.transactions
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.baby_record_feed_days();

-- Rattrapage à partir des transactions existantes (sans effet sur une base
-- neuve : aucun bébé n'existe encore ; utile si la migration est rejouée).
-- Ne fait qu'ajouter ou avancer des lignes, jamais en retirer.
INSERT INTO public.baby_feed_days AS d (user_id, day, fed_at)
SELECT f.user_id, (f.fed_at AT TIME ZONE 'UTC')::date, max(f.fed_at)
  FROM (
    SELECT t.user_id, LEAST(t.created_at, now()) AS fed_at
      FROM public.transactions t
  ) f
  JOIN public.baby_companions b ON b.user_id = f.user_id
 WHERE f.fed_at >= b.born_at
 GROUP BY f.user_id, (f.fed_at AT TIME ZONE 'UTC')::date
ON CONFLICT (user_id, day) DO UPDATE
  SET fed_at = EXCLUDED.fed_at
  WHERE d.fed_at < EXCLUDED.fed_at;

-- ─────────────────────────────────────────────────────────────
-- 3. État du bébé de l'utilisateur connecté
--    Filtré strictement par auth.uid() : aucun paramètre, impossible de lire
--    le bébé (ou le journal des repas) de quelqu'un d'autre.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_baby_status()
RETURNS TABLE (
  name TEXT,
  variant TEXT,
  born_at TIMESTAMPTZ,
  notifications_enabled BOOLEAN,
  fed_days INTEGER,
  last_fed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.name,
    b.variant,
    b.born_at,
    b.notifications_enabled,
    COALESCE(f.fed_days, 0)::integer,
    -- Pas encore de repas : le bébé vient de naître, il n'a pas faim.
    GREATEST(b.born_at, f.last_meal_at)
  FROM public.baby_companions b
  LEFT JOIN LATERAL (
    -- Une ligne par jour UTC (clé primaire) : count(*) = jours distincts.
    SELECT
      count(*) AS fed_days,
      max(d.fed_at) AS last_meal_at
    FROM public.baby_feed_days d
    WHERE d.user_id = b.user_id
      AND d.fed_at >= b.born_at
  ) f ON true
  WHERE b.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_baby_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_baby_status() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Liste interne pour baby-reminders (service_role uniquement)
--    Bébés avec rappels activés dont le propriétaire a au moins un abonnement
--    push actif, avec last_fed_at calculé comme dans get_baby_status()
--    (journal des repas : une suppression de transaction ne relance pas la faim).
--    Une seule requête pour tous les bébés (pas de N+1 côté Edge function).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.baby_hunger_candidates()
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  variant TEXT,
  last_fed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.user_id,
    b.name,
    b.variant,
    -- Dernier repas = fed_at du jour le plus récent du journal (une seule
    -- ligne lue via la clé primaire, voir baby_feed_days_day_check).
    -- Un repas antérieur à born_at est dominé par born_at : même résultat
    -- que get_baby_status().
    GREATEST(
      b.born_at,
      (SELECT d.fed_at
         FROM public.baby_feed_days d
        WHERE d.user_id = b.user_id
        ORDER BY d.day DESC
        LIMIT 1)
    )
  FROM public.baby_companions b
  WHERE b.notifications_enabled
    AND EXISTS (
      SELECT 1
        FROM public.push_subscriptions ps
       WHERE ps.user_id = b.user_id
         AND ps.disabled_at IS NULL
    );
$$;

REVOKE ALL ON FUNCTION public.baby_hunger_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.baby_hunger_candidates() TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 5. Planification : tous les jours à 12h UTC (midi à Abidjan)
--    Même schéma que reminders-morning / reminders-evening (token cron partagé).
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('baby-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='baby-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'baby-reminders',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xmganxsmfvcbuffeelej.supabase.co/functions/v1/baby-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', (SELECT value FROM public.system_config WHERE key = 'reminders_cron_token')
    ),
    body := '{}'::jsonb
  );
  $$
);
