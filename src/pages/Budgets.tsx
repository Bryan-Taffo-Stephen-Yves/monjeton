import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { BorderRotate } from "@/components/ui/animated-gradient-border";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePrivacy } from "@/contexts/PrivacyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Plus, Wallet, TrendingDown, TrendingUp, Sparkles, AlertTriangle, Loader2, Pencil, X, CheckCircle2, RefreshCw, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { resolveCategoryIcon } from "@/lib/categoryIconMap";
import { withAlpha } from "@/lib/budgetPlan";
import { BudgetCoachingFlow } from "@/components/budget/BudgetCoachingFlow";
import { PlanHistoryView } from "@/components/budget/PlanHistoryView";
import { History as HistoryIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CardSkeleton } from "@/components/DashboardSkeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { calculatePredictions, type SpendingPrediction } from "@/lib/predictions";
import { checkBudgetAlerts, type BudgetAlert } from "@/lib/budgetAlerts";
import BudgetAlertBanner from "@/components/BudgetAlertBanner";
import { syncAllAutoBudgets } from "@/lib/autoBudget";
import { findMatchingCategory } from "@/lib/categoryMatch";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: string;
}

interface CategoryBudget {
  id: string;
  category_id: string;
  budget_amount: number;
  category?: Category;
  spent?: number;
}

interface AISuggestion {
  categorie: string;
  montant_suggere: number;
  pourcentage: number;
  conseil: string;
  category_id?: string;
  already_spent?: number;
}

// Color-coded progress bar
const BudgetProgressBar = ({ percent, className = "" }: { percent: number; className?: string }) => {
  const actualPercent = Math.min(percent, 100);
  const isExceeded = percent > 100;

  const getColor = () => {
    if (percent > 100) return "hsl(0, 70%, 55%)";
    if (percent >= 85) return "hsl(0, 70%, 55%)";
    if (percent >= 60) return "hsl(30, 90%, 55%)";
    return "hsl(var(--primary))";
  };

  return (
    <div className={`relative h-2 w-full overflow-hidden rounded-full bg-secondary ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${isExceeded ? "animate-pulse" : ""}`}
        style={{
          width: `${actualPercent}%`,
          backgroundColor: getColor(),
        }}
      />
    </div>
  );
};

const Budgets = () => {
  const { user } = useAuth();
  const { formatAmount } = usePrivacy();
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [totalBudget, setTotalBudget] = useState(0);
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [newBudgetAmount, setNewBudgetAmount] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [newCatBudget, setNewCatBudget] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<SpendingPrediction[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [aiGlobalAdvice, setAiGlobalAdvice] = useState<string>("");
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editableSuggestions, setEditableSuggestions] = useState<AISuggestion[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [coachingDone, setCoachingDone] = useState<boolean | null>(null);
  const [showCoaching, setShowCoaching] = useState(false);
  const [coachingPlan, setCoachingPlan] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingCoaching, setLoadingCoaching] = useState(true);
  const [amountsHidden, setAmountsHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("budgets_amounts_hidden") === "true";
  });
  const toggleAmountsHidden = () => {
    setAmountsHidden((prev) => {
      const next = !prev;
      try { localStorage.setItem("budgets_amounts_hidden", String(next)); } catch {}
      return next;
    });
  };
  const MASK = "••••••";
  const MASK_AMT = "••••• F";
  const MASK_PCT = "••%";

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
  ];

  const [reloadKey, setReloadKey] = useState(0);
  const todayRef = new Date();
  const isCurrentMonth = month === todayRef.getMonth() + 1 && year === todayRef.getFullYear();
  const isPastMonth = year < todayRef.getFullYear() || (year === todayRef.getFullYear() && month < todayRef.getMonth() + 1);
  // On peut préparer le mois suivant, pas au-delà.
  const maxMonthIndex = todayRef.getFullYear() * 12 + todayRef.getMonth() + 1;
  const canGoNext = year * 12 + month - 1 < maxMonthIndex;
  const shiftMonth = (delta: number) => {
    const idx = year * 12 + (month - 1) + delta;
    setYear(Math.floor(idx / 12));
    setMonth((idx % 12) + 1);
  };

  useEffect(() => {
    if (user) loadData();
  }, [user, month, year, reloadKey]);

  useEffect(() => {
    const checkCoaching = async () => {
      if (!user) return;
      setLoadingCoaching(true);
      const { data } = await supabase
        .from('budget_coaching')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();
      const isApprouve = data?.statut === 'approuve';
      setCoachingDone(isApprouve);
      // Le parcours de création s'ouvre tout seul pour le mois en cours ou à
      // venir ; un mois passé sans budget affiche simplement la page.
      setShowCoaching(!isApprouve && !isPastMonth);
      setCoachingPlan(data);
      setLoadingCoaching(false);
    };
    checkCoaching();
  }, [user, month, year, reloadKey]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Auto-ajuste les budgets sur le mois en cours uniquement
      const today = new Date();
      const curMonthCheck = today.getMonth() + 1;
      const curYearCheck = today.getFullYear();
      if (month === curMonthCheck && year === curYearCheck) {
        await syncAllAutoBudgets(user.id, month, year).catch((e) =>
          console.error("syncAllAutoBudgets error:", e)
        );
      }

      const [budgetRes, catRes, txRes, catBudgetRes] = await Promise.all([
        supabase.from("budgets").select("*").eq("user_id", user.id).eq("month", month).eq("year", year).maybeSingle(),
        supabase.from("categories").select("*").eq("user_id", user.id).eq("type", "expense"),
        supabase.from("transactions").select("amount, category_id").eq("user_id", user.id).eq("type", "expense")
          .gte("date", `${year}-${String(month).padStart(2, "0")}-01`)
          .lt("date", month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`),
        supabase.from("category_budgets").select("*").eq("user_id", user.id).eq("month", month).eq("year", year),
      ]);

      if (budgetRes.data) {
        setTotalBudget(budgetRes.data.total_budget);
        setBudgetId(budgetRes.data.id);
      } else {
        setTotalBudget(0);
        setBudgetId(null);
      }

      const cats = catRes.data || [];
      setCategories(cats);

      const transactions = txRes.data || [];
      const spent = transactions.reduce((s, t) => s + Number(t.amount), 0);
      setTotalSpent(spent);

      const spentByCategory: Record<string, number> = {};
      transactions.forEach((t) => {
        if (t.category_id) {
          spentByCategory[t.category_id] = (spentByCategory[t.category_id] || 0) + Number(t.amount);
        }
      });

      const cBudgets = (catBudgetRes.data || []).map((cb: any) => ({
        ...cb,
        category: cats.find((c) => c.id === cb.category_id),
        spent: spentByCategory[cb.category_id] || 0,
      }));
      setCategoryBudgets(cBudgets);

      // Calculate predictions for current month
      const todayPred = new Date();
      const curMonth = todayPred.getMonth() + 1;
      const curYear = todayPred.getFullYear();
      if (month === curMonth && year === curYear && cBudgets.length > 0) {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const { data: histTx } = await supabase
          .from("transactions")
          .select("*, categories:category_id(name, icon, color)")
          .eq("user_id", user.id)
          .eq("type", "expense")
          .gte("date", threeMonthsAgo.toISOString().split("T")[0]);

        const allTx = histTx || [];
        const preds = calculatePredictions(allTx, cBudgets);
        setPredictions(preds);
        const alerts = checkBudgetAlerts(cBudgets, allTx, preds);
        setBudgetAlerts(alerts);
      } else {
        setPredictions([]);
        setBudgetAlerts([]);
      }
    } catch {
      toast({ title: "Erreur de chargement", description: "Impossible de charger les budgets", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveTotalBudget = async (): Promise<boolean> => {
    if (!user) return false;
    const amount = clampAmount(newBudgetAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Montant invalide", description: "Entre un nombre supérieur à 0", variant: "destructive" });
      return false;
    }
    try {
      if (budgetId) {
        const { error } = await supabase.from("budgets").update({ total_budget: amount }).eq("id", budgetId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budgets").insert({ user_id: user.id, month, year, total_budget: amount });
        if (error) throw error;
      }
      setNewBudgetAmount("");
      toast({ title: "Budget du mois mis à jour" });
      loadData();
      return true;
    } catch (e: any) {
      toast({ title: "Erreur sauvegarde", description: e?.message, variant: "destructive" });
      return false;
    }
  };

  const addCategoryBudget = async () => {
    if (!user || !selectedCategoryId) return;
    const amount = clampAmount(newCatBudget);
    if (!amount || amount <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("category_budgets").upsert(
      { user_id: user.id, category_id: selectedCategoryId, month, year, budget_amount: amount },
      { onConflict: "user_id,category_id,month,year" }
    );

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    setDialogOpen(false);
    setNewCatBudget("");
    setSelectedCategoryId("");
    toast({ title: "Budget catégorie ajouté" });
    loadData();
  };

  const saveInlineEdit = async (cbId: string) => {
    const amount = clampAmount(editValue);
    if (!amount || amount <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from("category_budgets").update({ budget_amount: amount }).eq("id", cbId);
      if (error) throw error;
      toast({ title: "Budget mis à jour" });
      setEditingId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erreur mise à jour", description: e?.message, variant: "destructive" });
    }
  };

  const deleteCategoryBudget = async (id: string) => {
    try {
      const { error } = await supabase.from("category_budgets").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Budget supprimé" });
      loadData();
    } catch {
      toast({ title: "Erreur de suppression", variant: "destructive" });
    }
  };

  // AI Suggestions: ask Claude to allocate the actual user budget across categories
  const generateAISuggestions = async () => {
    if (!user) return;

    if (!totalBudget || totalBudget <= 0) {
      toast({
        title: "Définis d'abord ton budget global",
        description: "L'IA répartit ton budget total réel — fixe-le avant de demander des suggestions.",
        variant: "destructive",
      });
      return;
    }

    setSuggestionsLoading(true);
    setShowSuggestions(true);
    setAiGlobalAdvice("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Non authentifié");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/budget-suggest`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          month,
          year,
          totalBudget,
          userCategories: categories
            .filter((c) => c.type === "expense")
            .map((c) => c.name),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur du service IA");
      }

      const data = await res.json();
      let suggestions: AISuggestion[] = Array.isArray(data.suggestions) ? data.suggestions : [];
      const expensesByCategory: Record<string, number> = data.expensesByCategory || {};

      // Frontend safeguard: re-calibrate if AI somehow exceeds budget
      const totalSuggere = suggestions.reduce((sum, s) => sum + s.montant_suggere, 0);
      if (totalSuggere > totalBudget && totalSuggere > 0) {
        const ratio = totalBudget / totalSuggere;
        suggestions = suggestions.map((s) => ({
          ...s,
          montant_suggere: Math.floor(s.montant_suggere * ratio),
          pourcentage: Math.round(((s.montant_suggere * ratio) / totalBudget) * 100),
        }));
      }

      // Match each suggestion to a real category id with robust fallbacks
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[&/,()._-]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const SYNONYMS: Record<string, string[]> = {
        epargne: ["autre", "freelance", "salaire"],
        investissement: ["autre"],
        business: ["freelance", "autre"],
        entreprise: ["freelance", "autre"],
        pro: ["freelance"],
        imprevus: ["autre"],
        famille: ["autre"],
        soutien: ["autre"],
        education: ["autre", "loisirs"],
        scolarite: ["autre"],
        logement: ["factures", "autre"],
        loyer: ["factures", "autre"],
      };

      const normCats = categories.map((c) => ({ ...c, _norm: normalize(c.name) }));

      const findCategoryId = (rawName: string): string | undefined => {
        const norm = normalize(rawName);
        // 1) exact normalized match
        const exact = normCats.find((c) => c._norm === norm);
        if (exact) return exact.id;
        // 2) any meaningful word from suggestion matches a category name (or vice versa)
        const words = norm.split(" ").filter((w) => w.length >= 4);
        for (const w of words) {
          const hit = normCats.find((c) => c._norm === w || c._norm.includes(w) || w.includes(c._norm));
          if (hit) return hit.id;
        }
        // 3) synonym mapping
        for (const w of words) {
          const targets = SYNONYMS[w];
          if (!targets) continue;
          for (const t of targets) {
            const hit = normCats.find((c) => c._norm === t);
            if (hit) return hit.id;
          }
        }
        return undefined;
      };

      const enriched: AISuggestion[] = suggestions.map((s) => {
        const norm = normalize(s.categorie);
        const category_id = findCategoryId(s.categorie);
        const spent =
          Object.entries(expensesByCategory).find(
            ([k]) => normalize(k) === norm
          )?.[1] ?? 0;
        return {
          ...s,
          category_id,
          already_spent: Number(spent) || 0,
        };
      });

      setEditableSuggestions(enriched);
      setAiGlobalAdvice(String(data.conseil_global || ""));

      if (enriched.length === 0) {
        toast({
          title: "Aucune suggestion",
          description: "L'IA n'a pas pu générer de répartition pour ce budget.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Erreur IA",
        description: e?.message || "Impossible de générer les suggestions",
        variant: "destructive",
      });
      setShowSuggestions(false);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const SAFE_MAX = 999999999;
  const clampAmount = (n: number | string) => {
    const num = typeof n === "string" ? Number(n.replace(/\s/g, "")) : Number(n);
    if (isNaN(num)) return 0;
    return Math.min(SAFE_MAX, Math.max(0, Math.floor(num)));
  };

  const updateSuggestionAmount = (categorie: string, newAmount: number) => {
    const safe = clampAmount(newAmount);
    setEditableSuggestions((prev) =>
      prev.map((s) => {
        if (s.categorie !== categorie) return s;
        const newPercent = totalBudget > 0
          ? Math.round((safe / totalBudget) * 100)
          : 0;
        return { ...s, montant_suggere: safe, pourcentage: newPercent };
      })
    );
  };

  const upsertCategoryBudgetFromSuggestion = async (s: AISuggestion) => {
    if (!user) return false;
    let categoryId = s.category_id;
    if (!categoryId) {
      // Éviter les doublons : on réutilise une catégorie proche si elle existe
      const { data: existingCats } = await supabase
        .from("categories")
        .select("id, name, type")
        .eq("user_id", user.id);
      const near = findMatchingCategory(s.categorie, (existingCats || []) as any[], "expense");
      if (near?.id) {
        categoryId = near.id;
      }
    }
    if (!categoryId) {
      const { data: newCat, error: createErr } = await supabase
        .from("categories")
        .insert({
          user_id: user.id,
          name: s.categorie,
          type: "expense",
          icon: "MoreHorizontal",
          color: "hsl(0, 0%, 60%)",
        })
        .select("id")
        .single();
      if (createErr || !newCat) {
        throw new Error(createErr?.message || "Impossible de créer la catégorie");
      }
      categoryId = newCat.id;
    }
    const { error } = await supabase.from("category_budgets").upsert(
      {
        user_id: user.id,
        category_id: categoryId,
        month,
        year,
        budget_amount: clampAmount(s.montant_suggere),
      },
      { onConflict: "user_id,category_id,month,year" }
    );
    if (error) throw error;
    return true;
  };

  const approveSuggestion = async (s: AISuggestion) => {
    if (approvingId === s.categorie) return;
    if (!user) return;
    if (suggestionsTotal > totalBudget) {
      toast({
        title: "Total dépasse ton budget",
        description: `Réduis d'abord d'au moins ${fmt(suggestionsTotal - totalBudget)}`,
        variant: "destructive",
      });
      return;
    }
    setApprovingId(s.categorie);
    try {
      await upsertCategoryBudgetFromSuggestion(s);
      setEditableSuggestions((prev) => prev.filter((item) => item.categorie !== s.categorie));
      toast({
        title: `Budget ${s.categorie} approuvé`,
        description: `${fmt(s.montant_suggere)} alloués`,
      });
      await loadData();
    } catch (e: any) {
      toast({ title: "Erreur approbation", description: e?.message, variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const approveAllSuggestions = async () => {
    if (approvingAll) return;
    if (!user || editableSuggestions.length === 0) return;
    if (suggestionsTotal > totalBudget) {
      toast({
        title: "Total dépasse ton budget",
        description: `Ajuste d'abord les montants pour rester sous ${fmt(totalBudget)}`,
        variant: "destructive",
      });
      return;
    }
    setApprovingAll(true);
    const snapshot = [...editableSuggestions];
    try {
      let successCount = 0;
      const failed: AISuggestion[] = [];
      for (const s of snapshot) {
        try {
          await upsertCategoryBudgetFromSuggestion(s);
          successCount++;
        } catch (err) {
          console.error(`Approve failed for ${s.categorie}:`, err);
          failed.push(s);
        }
      }
      setEditableSuggestions(failed);
      if (failed.length === 0) setShowSuggestions(false);
      toast({
        title: `${successCount} budget(s) approuvé(s)`,
        description: failed.length > 0
          ? `${failed.length} échec(s) — réessaie`
          : "Ta répartition est maintenant active",
      });
      await loadData();
    } catch (e: any) {
      toast({ title: "Erreur approbation globale", description: e?.message, variant: "destructive" });
    } finally {
      setApprovingAll(false);
    }
  };

  const budgetUsedPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const suggestionsTotal = useMemo(
    () => editableSuggestions.reduce((s, item) => s + (Number(item.montant_suggere) || 0), 0),
    [editableSuggestions]
  );
  const suggestionsRestant = totalBudget - suggestionsTotal;
  const isOverAllocated = suggestionsTotal > totalBudget;
  const allocationPercent = totalBudget > 0
    ? Math.round((suggestionsTotal / totalBudget) * 100)
    : 0;
  const isOverBudget = totalSpent > totalBudget && totalBudget > 0;
  const fmt = (n: number) => formatAmount(n);

  // Count exceeded category budgets
  const exceededCount = useMemo(
    () => categoryBudgets.filter((cb) => (cb.spent || 0) > cb.budget_amount && cb.budget_amount > 0).length,
    [categoryBudgets]
  );

  // Total budgeted across categories
  const totalCategoryBudgeted = useMemo(
    () => categoryBudgets.reduce((s, cb) => s + cb.budget_amount, 0),
    [categoryBudgets]
  );
  const totalCategorySpent = useMemo(
    () => categoryBudgets.reduce((s, cb) => s + (cb.spent || 0), 0),
    [categoryBudgets]
  );

  const getStatusLabel = (pct: number) => {
    if (pct > 100) return { text: "Dépassé !", color: "text-destructive" };
    if (pct >= 85) return { text: "Critique", color: "text-destructive" };
    if (pct >= 60) return { text: "Attention", color: "text-[hsl(30,90%,55%)]" };
    return { text: "En bonne voie", color: "text-primary" };
  };

  // Budget de référence : le budget global, sinon la somme des postes.
  const effectiveBudget = totalBudget > 0 ? totalBudget : totalCategoryBudgeted;
  const usedPercent = effectiveBudget > 0 ? (totalSpent / effectiveBudget) * 100 : 0;
  const left = effectiveBudget - totalSpent;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysLeftInclToday = isCurrentMonth ? daysInMonth - todayRef.getDate() + 1 : 0;
  const perDay = daysLeftInclToday > 0 && left > 0 ? Math.floor(left / daysLeftInclToday) : 0;
  const ringColor =
    usedPercent > 100 || usedPercent >= 85
      ? "hsl(var(--destructive))"
      : usedPercent >= 60
        ? "hsl(30, 90%, 55%)"
        : "hsl(var(--primary))";
  const heroStatus = getStatusLabel(usedPercent);

  const [editingTotal, setEditingTotal] = useState(false);

  const sortedCategoryBudgets = useMemo(
    () =>
      [...categoryBudgets].sort((a, b) => {
        const pa = a.budget_amount > 0 ? (a.spent || 0) / a.budget_amount : 0;
        const pb = b.budget_amount > 0 ? (b.spent || 0) / b.budget_amount : 0;
        return pb - pa;
      }),
    [categoryBudgets]
  );

  const projection = (() => {
    if (!effectiveBudget || amountsHidden || !isCurrentMonth) return null;
    const daysPassed = todayRef.getDate();
    const projectedTotal = Math.round((totalSpent / daysPassed) * daysInMonth);
    return { projectedTotal, over: projectedTotal > effectiveBudget };
  })();

  return (
    <DashboardLayout title="Budgets">
      {/* Sélecteur de mois */}
      <div className="flex items-center justify-between gap-2 mb-4 rounded-2xl bg-card border border-border p-1.5">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Mois précédent"
          className="w-11 h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-[15px] font-extrabold text-foreground">{monthNames[month - 1]} {year}</p>
          <p className={`text-[11px] font-semibold ${isCurrentMonth ? "text-primary" : "text-muted-foreground"}`}>
            {isCurrentMonth ? "Ce mois-ci" : isPastMonth ? "Mois passé" : "Mois prochain"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={!canGoNext}
          aria-label="Mois suivant"
          className="w-11 h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {loadingCoaching ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : showCoaching ? (
        <BudgetCoachingFlow
          key={`${year}-${month}`}
          month={month}
          year={year}
          onCancel={coachingDone ? () => setShowCoaching(false) : undefined}
          onComplete={() => {
            setShowCoaching(false);
            setCoachingDone(true);
            setReloadKey((k) => k + 1);
            window.scrollTo({ top: 0 });
          }}
        />
      ) : loading ? (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : effectiveBudget <= 0 && categoryBudgets.length === 0 ? (
        /* Aucun budget pour ce mois */
        <div className="rounded-3xl border border-border bg-card p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/15 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <p className="text-lg font-extrabold mt-4">Pas de budget pour {monthNames[month - 1].toLowerCase()}</p>
          <p className="text-sm text-muted-foreground mt-1.5">
            En 3 étapes, on répartit ton revenu pour tenir tout le mois.
          </p>
          <Button className="mt-5 h-12 w-full gradient-primary text-primary-foreground font-bold" onClick={() => setShowCoaching(true)}>
            <Sparkles className="w-4 h-4 mr-2" /> Créer mon budget
          </Button>
        </div>
      ) : (
        <>
          {/* ── Carte principale ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-5 mb-3 border"
            style={{
              background: `linear-gradient(150deg, ${
                left >= 0 ? "hsl(var(--primary) / 0.13)" : "hsl(var(--destructive) / 0.15)"
              }, hsl(var(--card)) 68%)`,
              borderColor: left >= 0 ? "hsl(var(--primary) / 0.22)" : "hsl(var(--destructive) / 0.3)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground">Budget de {monthNames[month - 1].toLowerCase()}</span>
                <button
                  type="button"
                  onClick={toggleAmountsHidden}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  aria-label={amountsHidden ? "Afficher les montants" : "Masquer les montants"}
                >
                  {amountsHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {!amountsHidden && (
                <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 bg-background/40 ${heroStatus.color}`}>
                  {heroStatus.text}
                </span>
              )}
            </div>

            <div className="flex items-center gap-5 mt-3">
              <div className="relative w-[124px] h-[124px] flex-shrink-0" aria-hidden="true">
                <svg viewBox="0 0 124 124" className="w-full h-full -rotate-90">
                  <circle cx="62" cy="62" r="52" fill="none" stroke="hsl(var(--secondary))" strokeWidth="12" />
                  {!amountsHidden && (
                    <motion.circle
                      cx="62" cy="62" r="52" fill="none" stroke={ringColor} strokeWidth="12" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 52}
                      initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - Math.min(usedPercent, 100) / 100) }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold tabular-nums">{amountsHidden ? MASK_PCT : `${Math.round(usedPercent)}%`}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground">dépensé</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">{left >= 0 ? "Il te reste" : "Dépassé de"}</p>
                <p className={`text-[26px] leading-tight font-extrabold tabular-nums ${left >= 0 ? "text-primary" : "text-destructive"}`}>
                  {amountsHidden ? MASK_AMT : fmt(Math.abs(left))}
                </p>
                {!amountsHidden && perDay > 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
                    soit <span className="font-extrabold text-foreground tabular-nums">{fmt(perDay)}</span> par jour jusqu'au {daysInMonth}
                  </p>
                )}
                {!amountsHidden && left < 0 && isCurrentMonth && (
                  <p className="text-xs text-muted-foreground mt-1.5">Reste {daysLeftInclToday} jour{daysLeftInclToday > 1 ? "s" : ""} dans le mois.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-2xl bg-background/40 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> Dépensé</p>
                <p className="text-base font-extrabold tabular-nums mt-0.5">{amountsHidden ? MASK_AMT : fmt(totalSpent)}</p>
              </div>
              <button
                type="button"
                onClick={() => { setNewBudgetAmount(String(effectiveBudget || "")); setEditingTotal(true); }}
                className="rounded-2xl bg-background/40 px-3 py-2.5 text-left hover:bg-background/60 transition-colors"
                aria-label="Modifier le budget du mois"
              >
                <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Budget <Pencil className="w-3 h-3 ml-auto" /></p>
                <p className="text-base font-extrabold tabular-nums mt-0.5">{amountsHidden ? MASK_AMT : fmt(effectiveBudget)}</p>
              </button>
            </div>

            {projection && (
              <div className={`flex items-start gap-2 mt-3 px-3 py-2.5 rounded-2xl text-xs ${projection.over ? "bg-destructive/10" : "bg-background/40"}`}>
                {projection.over
                  ? <AlertTriangle className="w-4 h-4 flex-shrink-0 text-destructive" />
                  : <TrendingUp className="w-4 h-4 flex-shrink-0 text-primary" />}
                <p className={projection.over ? "text-destructive" : "text-muted-foreground"}>
                  À ce rythme, tu finiras le mois à{" "}
                  <span className="font-extrabold text-foreground tabular-nums">{fmt(projection.projectedTotal)}</span>
                  {projection.over ? ` (${fmt(projection.projectedTotal - effectiveBudget)} de trop).` : "."}
                </p>
              </div>
            )}
          </motion.div>

          {/* Actions secondaires */}
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
            {!isPastMonth && (
              <button type="button" onClick={() => setShowCoaching(true)} className="h-10 px-3.5 rounded-full border border-border bg-card text-xs font-bold whitespace-nowrap flex items-center gap-1.5 hover:border-primary/60">
                <RefreshCw className="w-3.5 h-3.5 text-primary" /> Refaire mon budget
              </button>
            )}
            <button
              type="button"
              onClick={generateAISuggestions}
              disabled={suggestionsLoading}
              className="h-10 px-3.5 rounded-full border border-border bg-card text-xs font-bold whitespace-nowrap flex items-center gap-1.5 hover:border-primary/60 disabled:opacity-60"
            >
              {suggestionsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
              Répartir avec l'IA
            </button>
            {coachingPlan?.id && (
              <button type="button" onClick={() => setShowHistory(!showHistory)} className="h-10 px-3.5 rounded-full border border-border bg-card text-xs font-bold whitespace-nowrap flex items-center gap-1.5 hover:border-primary/60">
                <HistoryIcon className="w-3.5 h-3.5 text-primary" /> {showHistory ? "Masquer l'historique" : "Mes modifications"}
              </button>
            )}
          </div>

          {showHistory && coachingPlan?.id && (
            <div className="mb-4">
              <PlanHistoryView coachingId={coachingPlan.id} />
            </div>
          )}

          <AnimatePresence>
            {exceededCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-destructive/15 border border-destructive/30 mb-4"
              >
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive font-semibold">
                  {exceededCount} poste{exceededCount > 1 ? "s" : ""} dépassé{exceededCount > 1 ? "s" : ""} ce mois-ci
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <BudgetAlertBanner alerts={budgetAlerts} />

          {/* Suggestions IA (inchangé) */}
          <AnimatePresence>
            {showSuggestions && editableSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 space-y-3 overflow-hidden"
              >
                <div className={`rounded-2xl bg-card p-4 border ${isOverAllocated ? "border-destructive/40" : "border-primary/25"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Budget du mois</p>
                      <p className="text-xl font-black text-foreground tabular-nums">{fmt(totalBudget)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Proposé</p>
                      <p className={`text-xl font-black tabular-nums ${isOverAllocated ? "text-destructive" : "text-primary"}`}>
                        {fmt(suggestionsTotal)}
                      </p>
                    </div>
                  </div>
                  <div className="relative h-2.5 bg-secondary rounded-full overflow-hidden mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(allocationPercent, 100)}%` }}
                      transition={{ duration: 0.3 }}
                      className={`h-full rounded-full ${isOverAllocated ? "bg-destructive" : allocationPercent > 90 ? "bg-yellow-500" : "gradient-primary"}`}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{allocationPercent}% réparti</span>
                    <span className={isOverAllocated ? "text-destructive font-bold" : "text-muted-foreground"}>
                      {isOverAllocated ? `Trop de ${fmt(suggestionsTotal - totalBudget)}` : `Reste ${fmt(suggestionsRestant)}`}
                    </span>
                  </div>
                </div>

                {aiGlobalAdvice && (
                  <div className="rounded-2xl bg-primary/5 p-3 border border-primary/20 flex gap-2 items-start">
                    <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground leading-relaxed">{aiGlobalAdvice}</p>
                  </div>
                )}

                <div className="space-y-2.5">
                  {editableSuggestions.map((s) => {
                    const restant = Math.max(0, s.montant_suggere - (s.already_spent || 0));
                    const noMatch = !s.category_id;
                    const isApproving = approvingId === s.categorie;
                    return (
                      <div key={s.categorie} className="rounded-2xl bg-card p-3.5 border border-border">
                        <div className="flex items-center gap-2 mb-2 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{s.categorie}</p>
                          <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full font-medium flex-shrink-0 tabular-nums">{s.pourcentage}%</span>
                          {noMatch && <span className="text-[10px] bg-yellow-500/15 text-yellow-500 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Nouveau</span>}
                        </div>
                        {s.conseil && <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{s.conseil}</p>}
                        <MoneyInput
                          value={s.montant_suggere}
                          onChange={(n) => updateSuggestionAmount(s.categorie, n)}
                          min={0}
                          className="mb-2 [&>input]:h-10 [&>input]:tabular-nums"
                        />
                        <p className="text-[11px] text-muted-foreground tabular-nums mb-2.5">
                          Déjà dépensé : {fmt(s.already_spent || 0)} · Reste :{" "}
                          <span className={restant > 0 ? "text-primary font-semibold" : "text-destructive"}>{fmt(restant)}</span>
                        </p>
                        <button
                          onClick={() => approveSuggestion(s)}
                          disabled={isOverAllocated || isApproving || s.montant_suggere <= 0}
                          className="w-full h-10 gradient-primary text-primary-foreground rounded-xl text-xs font-bold disabled:opacity-40"
                        >
                          {isApproving ? "Enregistrement…" : noMatch ? `Créer « ${s.categorie} »` : `Garder ${fmt(s.montant_suggere)}`}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-11" onClick={() => { setShowSuggestions(false); setEditableSuggestions([]); }} disabled={approvingAll}>
                    Fermer
                  </Button>
                  <Button className="flex-1 h-11 gradient-primary text-primary-foreground font-bold" onClick={approveAllSuggestions} disabled={isOverAllocated || approvingAll || editableSuggestions.length === 0}>
                    {approvingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Tout garder</>}
                  </Button>
                </div>
              </motion.div>
            )}
            {showSuggestions && !suggestionsLoading && editableSuggestions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mb-4">Aucune suggestion disponible.</p>
            )}
          </AnimatePresence>

          {/* ── Postes ── */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-foreground">Mes postes</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-10 rounded-full">
                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby={undefined} className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Ajouter un poste</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger className="bg-secondary border-border h-11">
                      <SelectValue placeholder="Choisir une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => {
                        const Icon = resolveCategoryIcon(c.icon);
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              <Icon className="w-4 h-4" style={{ color: c.color }} /> {c.name}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <MoneyInput
                    placeholder="Montant pour le mois"
                    value={newCatBudget}
                    onChange={(n) => setNewCatBudget(n ? String(n) : "")}
                    className="[&>input]:h-11"
                  />
                  <Button onClick={addCategoryBudget} className="w-full h-11 gradient-primary text-primary-foreground font-bold">Enregistrer</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2.5">
            {sortedCategoryBudgets.map((cb) => {
              const spent = cb.spent || 0;
              const pct = cb.budget_amount > 0 ? (spent / cb.budget_amount) * 100 : 0;
              const over = spent > cb.budget_amount && cb.budget_amount > 0;
              const pred = predictions.find((p) => p.category === (cb.category?.name || ""));
              const trendIcon = pred?.trend === "up"
                ? <TrendingUp className="w-3.5 h-3.5 text-destructive" aria-label="En hausse" />
                : pred?.trend === "down"
                  ? <TrendingDown className="w-3.5 h-3.5 text-primary" aria-label="En baisse" />
                  : null;
              const status = getStatusLabel(pct);
              const Icon = resolveCategoryIcon(cb.category?.icon);
              const color = cb.category?.color || "hsl(var(--primary))";
              const tip = (coachingPlan?.conseils_par_categorie as any)?.[cb.category?.name || ""];

              return (
                <motion.div
                  key={cb.id}
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-card border p-3.5"
                  style={{ borderColor: !amountsHidden && over ? "hsl(var(--destructive) / 0.45)" : "hsl(var(--border))" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: withAlpha(color, 0.16), color }}
                      aria-hidden="true"
                    >
                      <Icon className="w-5 h-5" strokeWidth={2.2} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-foreground truncate">{cb.category?.name || "Sans catégorie"}</p>
                        {trendIcon}
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {amountsHidden ? MASK_AMT : `${fmt(spent)} sur ${fmt(cb.budget_amount)}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-extrabold tabular-nums ${amountsHidden ? "" : over ? "text-destructive" : status.color}`}>
                        {amountsHidden ? MASK : over ? `−${fmt(spent - cb.budget_amount)}` : fmt(cb.budget_amount - spent)}
                      </p>
                      <p className="text-[10px] font-semibold text-muted-foreground">{over ? "dépassé" : "reste"}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    {amountsHidden ? <div className="h-2 w-full rounded-full bg-secondary" /> : <BudgetProgressBar percent={pct} />}
                  </div>

                  <div className="flex items-center justify-between mt-1.5">
                    <span className={`text-[11px] font-semibold ${amountsHidden ? "text-muted-foreground" : status.color}`}>
                      {amountsHidden ? MASK_PCT : `${status.text} · ${Math.round(pct)} %`}
                    </span>
                    <div className="flex items-center">
                      <button
                        onClick={() => {
                          if (editingId === cb.id) { setEditingId(null); return; }
                          setEditingId(cb.id);
                          setEditValue(String(cb.budget_amount));
                        }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
                        aria-label={editingId === cb.id ? "Annuler la modification" : `Modifier le budget ${cb.category?.name || ""}`}
                      >
                        {editingId === cb.id ? <X className="w-4 h-4 text-muted-foreground" /> : <Pencil className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      <ConfirmDeleteDialog onConfirm={() => deleteCategoryBudget(cb.id)} title="Supprimer ce poste du budget ?" />
                    </div>
                  </div>

                  <AnimatePresence>
                    {editingId === cb.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="flex gap-2 mt-2">
                          <MoneyInput
                            value={editValue}
                            autoFocus
                            onChange={(n) => setEditValue(n ? String(n) : "")}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") await saveInlineEdit(cb.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="flex-1 [&>input]:h-10"
                            placeholder="Nouveau montant"
                          />
                          <Button className="h-10 gradient-primary text-primary-foreground font-bold" onClick={() => saveInlineEdit(cb.id)}>OK</Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!amountsHidden && pred && !over && pred.predictedEndOfMonth > cb.budget_amount && (
                    <p className="text-[11px] text-[hsl(30,90%,55%)] mt-1.5">
                      Prévu en fin de mois : {fmt(Math.round(pred.predictedEndOfMonth))}
                    </p>
                  )}
                  {tip && (
                    <div className="mt-2 flex items-start gap-1.5 px-2.5 py-2 rounded-xl bg-primary/5 border border-primary/15">
                      <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{tip}</p>
                    </div>
                  )}
                </motion.div>
              );
            })}
            {categoryBudgets.length === 0 && (
              <div className="rounded-2xl bg-card border border-border p-6 text-center">
                <p className="text-sm font-semibold">Aucun poste pour ce mois</p>
                <p className="text-xs text-muted-foreground mt-1">Ajoute un poste ou refais ton budget pour répartir ton argent.</p>
              </div>
            )}
          </div>

          {/* Modifier le budget du mois */}
          <Dialog open={editingTotal} onOpenChange={setEditingTotal}>
            <DialogContent aria-describedby={undefined} className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Budget de {monthNames[month - 1].toLowerCase()}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground -mt-2">Combien tu veux dépenser au maximum ce mois-ci ?</p>
              <MoneyInput
                value={newBudgetAmount}
                onChange={(n) => setNewBudgetAmount(n ? String(n) : "")}
                autoFocus
                className="[&>input]:h-12 [&>input]:text-xl [&>input]:font-extrabold"
              />
              <Button
                className="w-full h-11 gradient-primary text-primary-foreground font-bold"
                onClick={async () => { if (await saveTotalBudget()) setEditingTotal(false); }}
              >
                Enregistrer
              </Button>
            </DialogContent>
          </Dialog>
        </>
      )}
    </DashboardLayout>
  );
};

export default Budgets;
