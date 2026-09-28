import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast as sonnerToast } from 'sonner';
import { useHideFab } from '@/lib/fabVisibility';
import type { Json } from '@/integrations/supabase/types';
import { findMatchingCategory } from '@/lib/categoryMatch';
import {
  buildPlanLines, balancePlan, fallbackSplit, planTotal,
  categoryStyle, type PlanLine,
} from '@/lib/budgetPlan';
import {
  IncomeStep, FixedStep, PlanStep, DoneStep, type FixedCharge,
} from '@/components/budget/BudgetCreationSteps';

/**
 * Création du budget du mois, en 3 étapes :
 *   1. le revenu, 2. les dépenses fixes, 3. le plan (IA) à ajuster,
 * puis un écran de confirmation.
 *
 * Le budget couvre tout le revenu : les dépenses fixes deviennent des
 * lignes du budget, et l'IA (budget-coaching-plan) ne répartit que le reste.
 * La progression est enregistrée dans budget_coaching pour reprendre plus tard.
 */

type Stage = 'income' | 'fixed' | 'plan' | 'done';

interface Props {
  month: number;
  year: number;
  onComplete: () => void;
  /** Affiché quand un budget existe déjà : permet de revenir sans rien changer. */
  onCancel?: () => void;
}

// Champs de budget_coaching attendus par l'edge function (valeurs par défaut
// pour ceux que le parcours ne demande plus).
const DEFAULT_CONTEXT = {
  revenu_type: 'fixe',
  dettes_mois: 0,
  dettes_details: [],
  revenu_exceptionnel: 0,
  revenu_exceptionnel_source: '',
  objectifs: ['epargne', 'maitrise'],
  situation_familiale: 'seul',
  nb_personnes: 1,
  habitude_depense: 'mixte',
  mois_special: 'normal',
  mois_special_note: '',
};

const stepNumber: Record<Stage, number> = { income: 1, fixed: 2, plan: 10, done: 10 };

export const BudgetCoachingFlow = ({ month, year, onComplete, onCancel }: Props) => {
  const { user } = useAuth();
  useHideFab();

  const [initialized, setInitialized] = useState(false);
  const [stage, setStage] = useState<Stage>('income');
  const [coachingId, setCoachingId] = useState<string | null>(null);
  const wasApproved = useRef(false);

  const [revenu, setRevenu] = useState(0);
  const [fixed, setFixed] = useState<FixedCharge[]>([]);
  const [lines, setLines] = useState<PlanLine[]>([]);
  const [advice, setAdvice] = useState('');
  const [tips, setTips] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!user) return;
      const { data: existing } = await supabase
        .from('budget_coaching')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();
      if (cancelled) return;

      if (existing) {
        setCoachingId(existing.id);
        wasApproved.current = existing.statut === 'approuve';
        const rev = Number(existing.revenu_principal) || 0;
        const rawCharges = Array.isArray(existing.charges_fixes) ? existing.charges_fixes : [];
        const charges: FixedCharge[] = rawCharges
          .map((c) => {
            const o = (c && typeof c === 'object' ? c : {}) as { nom?: unknown; montant?: unknown };
            return { nom: String(o.nom ?? '').trim(), montant: Number(o.montant) || 0 };
          })
          .filter((c) => c.nom);
        setRevenu(rev);
        setFixed(charges);

        // Brouillon déjà généré (et pas encore activé) : on reprend au plan.
        const plan = existing.plan_genere as { repartition?: Array<{ categorie: string; montant: number }>; lines?: PlanLine[]; conseil_global?: string } | null;
        if (existing.statut === 'complete' && Array.isArray(plan?.repartition) && rev > 0) {
          const restored: PlanLine[] = Array.isArray(plan.lines)
            ? plan.lines
            : buildPlanLines(charges, plan.repartition);
          setLines(restored);
          setAdvice(String(plan.conseil_global || ''));
          setTips((existing.conseils_par_categorie as Record<string, string> | null) || {});
          setStage('plan');
        } else {
          // Refaire un budget déjà actif repart du revenu (pré-rempli) ;
          // un brouillon interrompu reprend là où il s'était arrêté.
          const resume = existing.statut !== 'approuve' && existing.current_step >= 2 && rev > 0;
          setStage(resume ? 'fixed' : 'income');
        }
      } else {
        const { data: created } = await supabase
          .from('budget_coaching')
          .insert({ user_id: user.id, month, year, current_step: 1, statut: 'en_cours' })
          .select()
          .single();
        if (!cancelled && created) setCoachingId(created.id);
      }
      if (!cancelled) setInitialized(true);
    };
    init();
    return () => { cancelled = true; };
  }, [user, month, year]);

  const saveProgress = useCallback(async (next: Stage, patch: Record<string, unknown> = {}) => {
    if (!coachingId) return;
    await supabase
      .from('budget_coaching')
      .update({
        revenu_principal: revenu,
        charges_fixes: fixed as unknown as Json,
        current_step: stepNumber[next],
        ...patch,
      })
      .eq('id', coachingId);
  }, [coachingId, revenu, fixed]);

  const goTo = (next: Stage) => {
    setStage(next);
    window.scrollTo({ top: 0 });
    void saveProgress(next);
  };

  const generate = async () => {
    if (!user || !coachingId || generating) return;
    setGenerating(true);
    const fixedTotal = fixed.reduce((s, f) => s + f.montant, 0);
    const disponible = Math.max(0, revenu - fixedTotal);
    let repartition: Array<{ categorie: string; montant: number }> = [];
    let conseil = '';
    let conseils: Record<string, string> = {};

    if (disponible > 0) {
      try {
        const { data: session } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/budget-coaching-plan`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            context: { ...DEFAULT_CONTEXT, current_step: 2, revenu_principal: revenu, charges_fixes: fixed },
            disponible,
            month,
            year,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const plan = await res.json();
        if (!Array.isArray(plan?.repartition) || plan.repartition.length === 0) throw new Error('Plan vide');
        repartition = plan.repartition;
        conseil = String(plan.conseil_global || '');
        conseils = plan.conseils_par_categorie || {};
      } catch (e) {
        console.error('budget-coaching-plan indisponible, plan de départ local', e);
        repartition = fallbackSplit(disponible);
        conseil = "Voici un plan de départ. Ajuste-le à ta vie avec − et +.";
      }
    }

    // L'IA ne tombe pas toujours pile sur le total : on équilibre d'office.
    const planLines = balancePlan(buildPlanLines(fixed, repartition), revenu)
      .map((l) => ({ ...l, original: l.montant }));
    setLines(planLines);
    setAdvice(conseil);
    setTips(conseils);
    setGenerating(false);
    setStage('plan');
    window.scrollTo({ top: 0 });

    await saveProgress('plan', {
      plan_genere: { repartition: planLines.map((l) => ({ categorie: l.nom, montant: l.montant })), lines: planLines, conseil_global: conseil } as unknown as Json,
      conseils_par_categorie: conseils as Json,
      // Refaire un budget déjà actif ne le désactive pas tant que le nouveau n'est pas validé.
      statut: wasApproved.current ? 'approuve' : 'complete',
    });
  };

  const activate = async () => {
    if (!user || !coachingId || activating) return;
    const total = revenu;
    let finalLines = lines.filter((l) => l.montant > 0);
    const diff = total - planTotal(finalLines);
    if (diff < 0) return;

    // Ce qui n'est pas réparti va dans l'épargne.
    if (diff > 0) {
      const savings = finalLines.find((l) => /epargne|épargne/i.test(l.nom));
      finalLines = savings
        ? finalLines.map((l) => (l === savings ? { ...l, montant: l.montant + diff } : l))
        : [...finalLines, { key: 'epargne', nom: 'Épargne', montant: diff, fixed: false, touched: false, original: 0 }];
    }

    setActivating(true);
    try {
      // 1. Budget global du mois
      const { data: existingBudget } = await supabase
        .from('budgets').select('id')
        .eq('user_id', user.id).eq('month', month).eq('year', year)
        .maybeSingle();
      const budgetWrite = existingBudget
        ? await supabase.from('budgets').update({ total_budget: total }).eq('id', existingBudget.id)
        : await supabase.from('budgets').insert({ user_id: user.id, month, year, total_budget: total });
      if (budgetWrite.error) throw budgetWrite.error;

      // 2. Catégories : on réutilise une catégorie proche avant d'en créer une.
      const { data: cats, error: catErr } = await supabase
        .from('categories').select('id, name, type').eq('user_id', user.id);
      if (catErr) throw catErr;
      const pool = [...(cats || [])];
      // Deux lignes peuvent tomber sur la même catégorie : on additionne.
      const amountByCategory = new Map<string, number>();
      for (const line of finalLines) {
        let cat = findMatchingCategory(line.nom, pool, 'expense');
        if (!cat) {
          const style = categoryStyle(line.nom);
          const { data: created, error } = await supabase
            .from('categories')
            .insert({ user_id: user.id, name: line.nom, type: 'expense', icon: style.icon, color: style.color })
            .select('id, name, type')
            .single();
          if (error || !created) throw error || new Error(`Catégorie ${line.nom}`);
          cat = created;
          pool.push(created);
        }
        amountByCategory.set(cat.id, (amountByCategory.get(cat.id) || 0) + line.montant);
      }
      const categoryIds = [...amountByCategory.keys()];
      const { error: cbErr } = await supabase.from('category_budgets').upsert(
        categoryIds.map((id) => ({
          user_id: user.id, category_id: id, month, year, budget_amount: amountByCategory.get(id)!,
        })),
        { onConflict: 'user_id,category_id,month,year' }
      );
      if (cbErr) throw cbErr;

      // 3. Les anciennes lignes du mois qui ne font plus partie du plan
      if (categoryIds.length) {
        await supabase.from('category_budgets').delete()
          .eq('user_id', user.id).eq('month', month).eq('year', year)
          .not('category_id', 'in', `(${categoryIds.join(',')})`);
      }

      // 4. Le plan validé + l'historique des changements faits à la main
      await supabase.from('budget_coaching').update({
        plan_genere: {
          repartition: finalLines.map((l) => ({
            categorie: l.nom, montant: l.montant,
            pourcentage: total > 0 ? Math.round((l.montant / total) * 100) : 0,
          })),
          conseil_global: advice,
        } as Json,
        conseils_par_categorie: tips as Json,
        validated_categories: finalLines.map((l) => l.nom),
        modified_categories: Object.fromEntries(
          finalLines.filter((l) => l.touched && l.montant !== l.original)
            .map((l) => [l.nom, { original: l.original, current: l.montant }])
        ) as Json,
        statut: 'approuve',
        current_step: 10,
      }).eq('id', coachingId);

      const changed = finalLines.filter((l) => l.touched && l.montant !== l.original);
      if (changed.length) {
        await supabase.from('budget_plan_history').insert(changed.map((l) => ({
          user_id: user.id, coaching_id: coachingId, month, year,
          action: 'modified', category_name: l.nom,
          amount_before: l.original, amount_after: l.montant, difference: l.montant - l.original,
          applied: true,
        })));
      }

      wasApproved.current = true;
      setLines(finalLines);
      setStage('done');
      window.scrollTo({ top: 0 });
    } catch (e) {
      console.error('Activation du budget impossible', e);
      sonnerToast.error("Ton budget n'a pas pu être activé", {
        description: 'Vérifie ta connexion et réessaie.',
      });
    } finally {
      setActivating(false);
    }
  };

  const restart = () => {
    sonnerToast('Recommencer ton budget ?', {
      description: 'Ton revenu et tes dépenses fixes restent remplis.',
      duration: 10000,
      action: {
        label: 'Oui',
        onClick: () => {
          setLines([]);
          setAdvice('');
          goTo('income');
        },
      },
      cancel: { label: 'Non', onClick: () => {} },
    });
  };

  if (!initialized) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const cancel = wasApproved.current && stage !== 'done' ? onCancel : undefined;

  switch (stage) {
    case 'income':
      return <IncomeStep revenu={revenu} onChange={setRevenu} onNext={() => goTo('fixed')} onCancel={cancel} />;
    case 'fixed':
      return (
        <FixedStep
          revenu={revenu}
          fixed={fixed}
          onChange={setFixed}
          onBack={() => goTo('income')}
          onGenerate={generate}
          generating={generating}
          onCancel={cancel}
        />
      );
    case 'plan':
      return (
        <PlanStep
          month={month}
          total={revenu}
          lines={lines}
          advice={advice}
          onChange={setLines}
          onBalance={() => setLines(balancePlan(lines, revenu))}
          onBack={() => goTo('fixed')}
          onRestart={restart}
          onActivate={activate}
          activating={activating}
          onCancel={cancel}
        />
      );
    case 'done':
      return <DoneStep month={month} year={year} total={revenu} lines={lines} onFinish={onComplete} />;
  }
};

export default BudgetCoachingFlow;
