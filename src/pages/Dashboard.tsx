import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";

import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
const DashboardCharts = lazy(() => import("@/components/DashboardCharts"));

import DashboardTontineWidget from "@/components/DashboardTontineWidget";
import BudgetAlertBanner from "@/components/BudgetAlertBanner";
import SubscriptionRenewBanner from "@/components/SubscriptionRenewBanner";
import PaidButNoProBanner from "@/components/PaidButNoProBanner";
import DashboardPredictions from "@/components/DashboardPredictions";
import { calculatePredictions, type SpendingPrediction } from "@/lib/predictions";
import { checkBudgetAlerts, type BudgetAlert } from "@/lib/budgetAlerts";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, MessageCircle, Camera, CalendarIcon, Sparkles, RefreshCw, Mic, SlidersHorizontal, Plus, PieChart, Users, ChevronRight, Flame } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BorderRotate } from "@/components/ui/animated-gradient-border";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { getCatIcon } from "@/lib/getCatIcon";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePrivacy } from "@/contexts/PrivacyContext";
import { supabase } from "@/integrations/supabase/client";
import { CardSkeleton, ListItemSkeleton, ChartSkeleton } from "@/components/DashboardSkeleton";
import { CalendarWithPresets } from "@/components/ui/calendar-with-presets";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import DailyReminderModal from "@/components/DailyReminderModal";
import MonthlyBadge from "@/components/MonthlyBadge";
import { calculateMonthlyBadge, type Badge } from "@/lib/badgeCalculator";
const trendModes = ["Jour", "Mois"];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { formatAmount } = usePrivacy();
  const { toast } = useToast();
  const [activePeriod, setActivePeriod] = useState<"Jour" | "Semaine" | "Mois" | "Année" | "Custom">("Jour");
  const [trendMode, setTrendMode] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [allTimeEmpty, setAllTimeEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Vrai dès qu'un premier chargement s'est terminé : évite de vider l'écran
  // à chaque changement de période.
  const hasLoadedOnceRef = useRef(false);

  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [newTxCount, setNewTxCount] = useState(0);
  const [dailyReminder, setDailyReminder] = useState<{ show: boolean; txCount: number }>({ show: false, txCount: 0 });
  const [streak, setStreak] = useState(0);
  const [monthlyBadge, setMonthlyBadge] = useState<{ show: boolean; badge: Badge | null; month: string; savingsRate: number }>({ show: false, badge: null, month: "", savingsRate: 0 });
  const [predictions, setPredictions] = useState<SpendingPrediction[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const DEFAULT_BLOCKS_ORDER = ["wallets", "plan", "predictions", "transactions", "tontines"] as const;
  type BlockKey = typeof DEFAULT_BLOCKS_ORDER[number];
  const [showPredictions, setShowPredictions] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("dashboard_show_predictions") !== "false";
  });
  const [showPlan, setShowPlan] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("dashboard_show_plan") !== "false";
  });
  const [showTransactions, setShowTransactions] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("dashboard_show_transactions") !== "false";
  });
  const [showTontines, setShowTontines] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("dashboard_show_tontines") !== "false";
  });
  const [blocksOrder, setBlocksOrder] = useState<BlockKey[]>(() => {
    if (typeof window === "undefined") return [...DEFAULT_BLOCKS_ORDER];
    try {
      const raw = localStorage.getItem("dashboard_blocks_order");
      if (!raw) return [...DEFAULT_BLOCKS_ORDER];
      const parsed = JSON.parse(raw) as string[];
      const valid = parsed.filter((k): k is BlockKey => (DEFAULT_BLOCKS_ORDER as readonly string[]).includes(k));
      // Append any new keys not yet stored
      DEFAULT_BLOCKS_ORDER.forEach(k => { if (!valid.includes(k)) valid.push(k); });
      return valid;
    } catch { return [...DEFAULT_BLOCKS_ORDER]; }
  });
  const persistOrder = (next: BlockKey[]) => {
    setBlocksOrder(next);
    try { localStorage.setItem("dashboard_blocks_order", JSON.stringify(next)); } catch {}
  };
  const moveBlock = (key: BlockKey, dir: -1 | 1) => {
    const idx = blocksOrder.indexOf(key);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= blocksOrder.length) return;
    const next = [...blocksOrder];
    [next[idx], next[target]] = [next[target], next[idx]];
    persistOrder(next);
  };
  const togglePredictions = (v: boolean) => {
    setShowPredictions(v);
    try { localStorage.setItem("dashboard_show_predictions", String(v)); } catch {}
  };
  const togglePlan = (v: boolean) => {
    setShowPlan(v);
    try { localStorage.setItem("dashboard_show_plan", String(v)); } catch {}
  };
  const toggleTransactions = (v: boolean) => {
    setShowTransactions(v);
    try { localStorage.setItem("dashboard_show_transactions", String(v)); } catch {}
  };
  const toggleTontines = (v: boolean) => {
    setShowTontines(v);
    try { localStorage.setItem("dashboard_show_tontines", String(v)); } catch {}
  };
  const resetCustomization = () => {
    togglePredictions(true);
    togglePlan(true);
    toggleTransactions(true);
    toggleTontines(true);
    persistOrder([...DEFAULT_BLOCKS_ORDER]);
  };
  const hiddenCount = [showPredictions, showPlan, showTransactions, showTontines].filter(v => !v).length;

  


  useEffect(() => {
    const save = () => sessionStorage.setItem("dashboard_last_visit", new Date().toISOString());
    window.addEventListener("beforeunload", save);
    return () => {
      window.removeEventListener("beforeunload", save);
      save();
    };
  }, []);

  // Pet reminder: check inactivity and (re)schedule the gentle local notif.
  useEffect(() => {
    if (!user) return;
    import("@/lib/petReminders")
      .then((m) => m.checkPetActivity({ userId: user.id }))
      .catch(() => {});
  }, [user]);

  // Daily reminder check
  useEffect(() => {
    const checkDailyReminder = async () => {
      if (!user) return;
      const hour = new Date().getHours();
      if (hour < 18 || hour > 22) return;
      try {
        const today = new Date().toISOString().split("T")[0];

        const { data: reminder } = await supabase
          .from("daily_reminders")
          .select("*")
          .eq("user_id", user.id)
          .eq("date", today)
          .maybeSingle();

        if (reminder) return;

        const { data: todayTx } = await supabase
          .from("transactions")
          .select("id")
          .eq("user_id", user.id)
          .eq("date", today);

        const txCount = todayTx?.length || 0;
        setDailyReminder({ show: true, txCount });

        await supabase.from("daily_reminders").insert({
          user_id: user.id,
          date: today,
          transactions_count: txCount,
        });
      } catch {
        console.warn("daily_reminders table not ready");
      }
    };

    const checkDebtReminders = async () => {
      if (!user) return;
      try {
        const today = new Date();
        const in3days = new Date(today);
        in3days.setDate(today.getDate() + 3);
        const in3daysStr = in3days.toISOString().split("T")[0];
        const todayStr = today.toISOString().split("T")[0];

        const { data: debts } = await supabase
          .from("debts")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .not("due_date", "is", null)
          .lte("due_date", in3daysStr)
          .gte("due_date", todayStr);

        if (debts && debts.length > 0) {
          debts.forEach(debt => {
            const daysLeft = Math.ceil(
              (new Date(debt.due_date!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );
            toast({
              title: daysLeft <= 0
                ? `Échéance aujourd'hui`
                : `Rappel dans ${daysLeft} jour(s)`,
              description: debt.type === "owed_to_me"
                ? `${debt.person_name} te doit encore ${Number(debt.amount).toLocaleString()}`
                : `Tu dois ${Number(debt.amount).toLocaleString()} à ${debt.person_name}`,
            });
          });
        }
      } catch { /* silencieux */ }
    };

    checkDailyReminder();
    checkDebtReminders();
  }, [user]);

  // Streak calculation
  useEffect(() => {
    const calcStreak = async () => {
      if (!user) return;
      try {
        const { data: reminders } = await supabase
          .from("daily_reminders")
          .select("date, transactions_count")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(30);

        if (!reminders || reminders.length === 0) return;

        let s = 0;
        const today = new Date();
        for (let i = 0; i < reminders.length; i++) {
          const expected = new Date(today);
          expected.setDate(today.getDate() - i);
          const expectedStr = expected.toISOString().split("T")[0];
          if (reminders[i]?.date === expectedStr && reminders[i]?.transactions_count > 0) {
            s++;
          } else break;
        }
        setStreak(s);
      } catch {
        console.warn("daily_reminders streak calc not ready");
      }
    };

    calcStreak();
  }, [user, dailyReminder]);

  // Monthly badge check (on 1st of month)
  useEffect(() => {
    const checkMonthlyBadge = async () => {
      if (!user || !profile) return;
      try {
        const today = new Date();
        if (today.getDate() !== 1) return;

        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthKey = `badge_${lastMonth.getFullYear()}_${lastMonth.getMonth()}`;
        if (localStorage.getItem(lastMonthKey)) return;

        const startDate = lastMonth.toISOString().split("T")[0];
        const endDate = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split("T")[0];

        const { data: monthTx } = await supabase
          .from("transactions")
          .select("*, categories(name, icon, color)")
          .eq("user_id", user.id)
          .gte("date", startDate)
          .lte("date", endDate);

        if (!monthTx || monthTx.length === 0) return;

        const badge = calculateMonthlyBadge(monthTx, profile);
        const totalIncome = monthTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
        const totalExpense = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
        const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

        const monthName = lastMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

        await supabase.from("monthly_badges").insert({
          user_id: user.id,
          month: lastMonth.getMonth() + 1,
          year: lastMonth.getFullYear(),
          badge_id: badge.id,
        });

        localStorage.setItem(lastMonthKey, "shown");
        setMonthlyBadge({ show: true, badge, month: monthName, savingsRate });
      } catch {
        console.warn("monthly_badges table not ready");
      }
    };

    checkMonthlyBadge();
  }, [user, profile]);

  const dateRange = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    if (activePeriod === "Jour") {
      return { start: today, end: today, label: "aujourd'hui" };
    }
    if (activePeriod === "Semaine") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { start: start.toISOString().split("T")[0], end: today, label: "7 derniers jours" };
    }
    if (activePeriod === "Mois") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: start.toISOString().split("T")[0], end: today, label: "ce mois-ci" };
    }
    if (activePeriod === "Année") {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: start.toISOString().split("T")[0], end: today, label: "cette année" };
    }
    if (activePeriod === "Custom" && customRange?.from) {
      const start = customRange.from.toISOString().split("T")[0];
      const end = (customRange.to || customRange.from).toISOString().split("T")[0];
      return { start, end, label: "période personnalisée" };
    }
    return { start: today, end: today, label: "aujourd'hui" };
  }, [activePeriod, customRange]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    if (activePeriod === "Custom" && !customRange?.from) return;

    // On n'affiche les squelettes qu'au tout premier chargement. Lors d'un
    // changement de période, on garde l'écran précédent affiché : sinon, une
    // requête lente ou bloquée vide complètement le tableau de bord.
    if (!hasLoadedOnceRef.current) setLoading(true);
    setError(null);

    // Garde-fou : sans délai maximal, une requête qui n'aboutit jamais laisse
    // l'écran bloqué en chargement (bug signalé sur la période "Mois").
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 15000);

    try {
    const { data, error: fetchError } = await supabase
      .from("transactions")
      .select("*, categories(name, icon, color)")
      .eq("user_id", user.id)
      .gte("date", dateRange.start)
      .lte("date", dateRange.end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500)
      .abortSignal(timeout.signal);

    if (fetchError) throw fetchError;
    const txs = data || [];
    setTransactions(txs);

    if (txs.length === 0 && activePeriod === "Jour") {
      const { count } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setAllTimeEmpty(count === 0);
    } else {
      setAllTimeEmpty(false);
    }

    const lastVisit = sessionStorage.getItem("dashboard_last_visit");
    if (lastVisit) {
      const count = txs.filter(t => new Date(t.created_at) > new Date(lastVisit)).length;
      setNewTxCount(count);
    }
    } catch (e) {
      // On loggue l'erreur réelle : sans ça, ce type de bug est indébogable.
      console.error("[Dashboard] fetchData a échoué", {
        period: activePeriod,
        range: { start: dateRange.start, end: dateRange.end },
        aborted: timeout.signal.aborted,
        error: e,
      });
      setError(
        timeout.signal.aborted
          ? "Le chargement a pris trop de temps. Réessaie."
          : "Impossible de charger. Vérifie ta connexion."
      );
    } finally {
      clearTimeout(timer);
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [user, activePeriod, customRange, dateRange.start, dateRange.end]);


  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch predictions & budget alerts
  useEffect(() => {
    const fetchPredictions = async () => {
      if (!user) return;
      try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const [catBudgetRes, txRes] = await Promise.all([
          supabase.from("category_budgets").select("*, categories:category_id(name, icon, color)").eq("user_id", user.id).eq("month", month).eq("year", year),
          supabase.from("transactions").select("*, categories:category_id(name, icon, color)").eq("user_id", user.id).eq("type", "expense").gte("date", threeMonthsAgo.toISOString().split("T")[0]),
        ]);

        const catBudgets = catBudgetRes.data || [];
        const allTx = txRes.data || [];

        if (catBudgets.length > 0) {
          const preds = calculatePredictions(allTx, catBudgets);
          setPredictions(preds);
          const alerts = checkBudgetAlerts(catBudgets, allTx, preds);
          setBudgetAlerts(alerts);
        }
      } catch {
        // silent
      }
    };
    fetchPredictions();
  }, [user]);

  /**
   * Message d'accueil contextuel — remplace le générique "Bonjour + nom".
   * Choisit un message pertinent selon l'heure, la date du mois, les
   * dépenses du jour et la santé du budget. Toujours factuel et court,
   * jamais moralisateur (l'utilisateur n'aime pas se sentir jugé).
   */
  const buildGreeting = (): { hello: string; context: string | null } => {
    const now = new Date();
    const h = now.getHours();
    const day = now.getDate();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = lastDayOfMonth - day;
    const firstName = (profile?.full_name || "").split(" ")[0] || "";

    // salutation selon l'heure
    let hello = "Bonjour";
    if (h < 5) hello = "Bonne nuit";
    else if (h >= 5 && h < 12) hello = "Bonjour";
    else if (h >= 12 && h < 18) hello = "Bon après-midi";
    else hello = "Bonsoir";
    if (firstName) hello = `${hello} ${firstName}.`;

    // dépenses aujourd'hui
    const todayISO = new Date().toISOString().split("T")[0];
    const todayExpense = transactions
      .filter((t) => t.type === "expense" && t.date === todayISO)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // reste du mois si on connaît revenus + dépenses
    const monthBalance = totalIncome - totalExpense;
    const fmtMoney = (n: number) =>
      new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, "\u202F");

    // priorité 1 : dépense du jour (une seule fois par jour, factuel)
    if (todayExpense > 0 && h >= 12) {
      return { hello, context: `Tu as dépensé ${fmtMoney(todayExpense)} F aujourd'hui.` };
    }

    // priorité 2 : fin de mois avec reste positif
    if (daysLeft <= 5 && monthBalance > 0) {
      return {
        hello,
        context: `Plus que ${daysLeft} jour${daysLeft > 1 ? "s" : ""}. Il te reste ${fmtMoney(monthBalance)} F.`,
      };
    }

    // priorité 3 : début de mois — encourager
    if (day <= 3 && totalIncome > 0) {
      return { hello, context: "Un nouveau mois commence." };
    }

    // priorité 4 : matin — inviter à noter
    if (h >= 5 && h < 11 && todayExpense === 0) {
      return { hello, context: "Comment se passe ta journée ?" };
    }

    // sinon rien : on garde juste la salutation
    return { hello, context: null };
  };

    const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  // IMPORTANT : buildGreeting() lit totalIncome / totalExpense.
  // L'appel doit donc venir APRÈS leurs déclarations, sinon on déclenche
  // une ReferenceError (zone morte temporelle) qui fait planter tout l'écran.
  const greeting = buildGreeting();

  const expenseByCategory = transactions
    .filter(t => t.type === "expense")
    .reduce((acc: Record<string, { name: string; amount: number; color: string }>, t) => {
      const cat = t.categories as any;
      const catName = cat?.name || "Autre";
      const catColor = cat?.color || "hsl(0,0%,50%)";
      if (!acc[catName]) acc[catName] = { name: catName, amount: 0, color: catColor };
      acc[catName].amount += Number(t.amount);
      return acc;
    }, {});

  const chartData: { name: string; amount: number; color: string }[] = Object.values(expenseByCategory);
  const recentTx = transactions.slice(0, 5);

  const trendData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === "expense");
    if (expenses.length === 0) return [];

    if (trendMode === 0) {
      const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
      const byDay: Record<number, number> = {};
      expenses.forEach(t => {
        let d = new Date(t.date).getDay();
        d = d === 0 ? 6 : d - 1;
        byDay[d] = (byDay[d] || 0) + Number(t.amount);
      });
      return days.map((name, i) => ({ name, amount: byDay[i] || 0 }));
    } else {
      const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
      const byMonth: Record<number, number> = {};
      expenses.forEach(t => {
        const m = new Date(t.date).getMonth();
        byMonth[m] = (byMonth[m] || 0) + Number(t.amount);
      });
      const now = new Date();
      const currentMonth = now.getMonth();
      const result = [];
      for (let i = 5; i >= 0; i--) {
        const m = (currentMonth - i + 12) % 12;
        result.push({ name: months[m], amount: byMonth[m] || 0 });
      }
      return result;
    }
  }, [transactions, trendMode]);

  return (
    <DashboardLayout
      headerLeft={
        <button
          type="button"
          aria-label="Personnaliser mon accueil"
          title="Personnaliser"
          onClick={() => setCustomizeOpen(true)}
          className="relative p-2 rounded-full glass-card text-muted-foreground hover:text-foreground transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {hiddenCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
              {hiddenCount}
            </span>
          )}
        </button>
      }
    >
      <SubscriptionRenewBanner />
      <PaidButNoProBanner />
      <div className="pt-4 sm:pt-6 pb-4 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Header contextuel : salutation + phrase pertinente selon l'heure et l'état du budget */}
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate leading-tight">
            {greeting.hello}
          </h1>
          {greeting.context && (
            <p className="text-primary text-[13px] font-semibold mt-1 truncate">
              {greeting.context}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 shrink-0">
          {streak > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1.5 rounded-full font-semibold"
            >
              <Flame className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />{streak} jour{streak > 1 ? "s" : ""} de suite
            </motion.div>
          )}
          <Sheet open={customizeOpen} onOpenChange={setCustomizeOpen}>
            <SheetContent side="bottom" className="bg-background/95 backdrop-blur-xl border-t border-border rounded-t-2xl max-h-[85vh] overflow-y-auto">
              <SheetHeader className="text-left">
                <SheetTitle className="text-foreground">Personnaliser mon accueil</SheetTitle>
                <SheetDescription>Active, masque ou réorganise les sections du tableau de bord.</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {blocksOrder.map((key, idx) => {
                  const meta: Record<BlockKey, { label: string; desc: string; checked?: boolean; onChange?: (v: boolean) => void; toggleable: boolean }> = {
                    wallets: { label: "Soldes (Revenus / Dépenses)", desc: "Toujours visible", toggleable: false },
                    plan: { label: "Plan financier du mois", desc: "Alertes de budget et plan en cours", checked: showPlan, onChange: togglePlan, toggleable: true },
                    predictions: { label: "Prévisions IA", desc: "Tendances et projections de fin de mois", checked: showPredictions, onChange: togglePredictions, toggleable: true },
                    transactions: { label: "Transactions récentes", desc: "Dernières opérations enregistrées", checked: showTransactions, onChange: toggleTransactions, toggleable: true },
                    tontines: { label: "Mes Tontines & Caisses", desc: "Caisses communes et tontines en cours", checked: showTontines, onChange: toggleTontines, toggleable: true },
                  };
                  const m = meta[key];
                  return (
                    <div key={key} className="flex items-center justify-between gap-3 glass-card rounded-xl p-3">
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          aria-label="Monter"
                          disabled={idx === 0}
                          onClick={() => moveBlock(key, -1)}
                          className="w-7 h-7 rounded-md bg-muted/40 text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted/60 flex items-center justify-center text-sm"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="Descendre"
                          disabled={idx === blocksOrder.length - 1}
                          onClick={() => moveBlock(key, 1)}
                          className="w-7 h-7 rounded-md bg-muted/40 text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted/60 flex items-center justify-center text-sm"
                        >
                          ↓
                        </button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <Label className="text-sm font-medium text-foreground">{m.label}</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                      </div>
                      {m.toggleable ? (
                        <Switch
                          checked={!!m.checked}
                          onCheckedChange={m.onChange}
                          className="data-[state=checked]:bg-primary"
                        />
                      ) : (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground px-2">Fixe</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={resetCustomization}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Restaurer l'affichage par défaut
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex gap-1 p-1 glass-card period-rail rounded-xl mb-2 sm:mb-3 overflow-x-auto">
        {(["Jour", "Semaine", "Mois", "Année"] as const).map((p) => (
          <button
            key={p}
            onClick={() => {
              setActivePeriod(p);
              setCustomRange(undefined);
            }}
            className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activePeriod === p
                ? "gradient-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p}
          </button>
        ))}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button onClick={() => { setActivePeriod("Custom"); setCalendarOpen(true); }} className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1 ${
              activePeriod === "Custom" && customRange?.from
                ? "gradient-primary text-primary-foreground ring-2 ring-primary/50 ring-offset-1 ring-offset-background font-semibold"
                : activePeriod === "Custom"
                  ? "gradient-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
            }`}>
              {activePeriod === "Custom" && customRange?.from
                ? customRange.to
                  ? `${format(customRange.from, "d MMM", { locale: fr })} → ${format(customRange.to, "d MMM", { locale: fr })}`
                  : format(customRange.from, "d MMM", { locale: fr })
                : <CalendarIcon className="w-4 h-4" />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <CalendarWithPresets
              selected={customRange}
              onSelect={(range) => {
                setCustomRange(range);
                if (range?.from && range?.to) setCalendarOpen(false);
              }}
              onPresetSelect={(range) => {
                setCustomRange(range);
                setCalendarOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <p className="text-xs text-muted-foreground mb-4 sm:mb-6 px-1">
        Données : <span className="text-foreground font-medium">{dateRange.label}</span>
      </p>

      {/* Message when custom range not selected */}
      {activePeriod === "Custom" && !customRange?.from && (
        <div className="glass-card rounded-2xl p-6 mb-6 text-center">
          <CalendarIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Sélectionnez une plage de dates dans le calendrier ci-dessus.</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="glass-card rounded-2xl p-6 text-center">
          <p className="text-destructive text-sm mb-3">{error}</p>
          <button
            onClick={() => { setError(null); fetchData(); }}
            className="inline-flex items-center gap-2 text-primary text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>
        </div>
      )}

      {!error && loading ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <ChartSkeleton />
          <div className="mt-6 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <ListItemSkeleton key={i} />)}
          </div>
        </>
      ) : !error && (
        <>
          {allTimeEmpty && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-6 mb-6 text-center">
              <p className="text-foreground font-medium mb-2">Bienvenue ! Commence par ajouter une dépense ou un revenu pour voir tes finances ici.</p>
              <button
                onClick={() => navigate("/transactions/new")}
                className="inline-flex items-center gap-2 text-primary font-semibold hover:underline"
              >
                Ajouter ma première transaction →
              </button>
            </motion.div>
          )}
          {(() => {
            const walletsBlock = (
              <div key="wallets" className="mb-4 sm:mb-6">
                {/* Duo Revenus / Dépenses — vert = ce qui rentre, rouge = ce qui sort */}
                <div className="grid grid-cols-2 gap-3">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <BorderRotate
                      tone="lime"
                      animationSpeed={9}
                      surface="hsl(var(--card))"
                      className="overflow-hidden"
                      style={{ borderRadius: 22 }}
                    >
                      <button
                        type="button"
                        onClick={() => navigate("/transactions/new", { state: { initialType: "income" } })}
                        aria-label="Ajouter un revenu"
                        className="money-income block w-full text-left relative p-4 overflow-hidden active:scale-[0.98] transition-transform"
                        style={{
                          borderRadius: 21,
                          background:
                            "linear-gradient(155deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.82) 100%)",
                        }}
                      >
                        <span
                          className="absolute -right-8 -bottom-11 w-28 h-28 rounded-full"
                          style={{ background: "hsl(var(--primary-foreground) / 0.16)" }}
                        />
                        <div className="relative flex items-center justify-between">
                          <span className="text-[13px] font-extrabold text-primary-foreground/70">Revenus</span>
                          <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--primary-foreground) / 0.16)" }}>
                            <ArrowDownLeft className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                          </span>
                        </div>
                        <p className="relative mt-2 text-[22px] leading-none font-extrabold tracking-[-0.04em] text-primary-foreground truncate tabular-nums">
                          {formatAmount(totalIncome)}
                        </p>
                      </button>
                    </BorderRotate>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                    <BorderRotate
                      tone="red"
                      animationSpeed={11}
                      surface="hsl(var(--card))"
                      className="overflow-hidden"
                      style={{ borderRadius: 22 }}
                    >
                      <button
                        type="button"
                        onClick={() => navigate("/transactions/new", { state: { initialType: "expense" } })}
                        aria-label="Ajouter une dépense"
                        className="money-expense block w-full text-left relative p-4 overflow-hidden active:scale-[0.98] transition-transform"
                        style={{
                          borderRadius: 21,
                          background:
                            "linear-gradient(155deg, hsl(var(--destructive) / 0.85) 0%, hsl(var(--destructive)) 100%)",
                        }}
                      >
                        <span className="absolute -right-8 -bottom-11 w-28 h-28 rounded-full bg-white/15" />
                        <div className="relative flex items-center justify-between">
                          <span className="text-[13px] font-extrabold text-white/75">Dépenses</span>
                          <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                            <ArrowUpRight className="w-3 h-3 text-white" strokeWidth={3} />
                          </span>
                        </div>
                        <p className="relative mt-2 text-[22px] leading-none font-extrabold tracking-[-0.04em] text-white truncate tabular-nums">
                          {formatAmount(totalExpense)}
                        </p>
                      </button>
                    </BorderRotate>
                  </motion.div>
                </div>

                {/* Trois actions rondes */}
                <div className="grid grid-cols-3 gap-3 mt-5 px-2">
                  {[
                    { Icon: Plus, label: "Saisir", go: () => navigate("/transactions/new") },
                    { Icon: Mic, label: "Parler", go: () => navigate("/transactions/new", { state: { autoVoice: true } }), accent: true },
                    { Icon: Camera, label: "Scanner", go: () => navigate("/scan") },
                  ].map(({ Icon, label, go, accent }) => (
                    <button key={label} onClick={go} className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
                      <span className={cn("w-[60px] h-[60px] rounded-full icon-3d flex items-center justify-center", accent ? "ring-1 ring-primary/45" : "")}>
                        <Icon className="w-[23px] h-[23px] text-primary" strokeWidth={1.9} />
                      </span>
                      <span className={cn("text-xs font-bold", accent ? "text-primary" : "text-foreground")}>{label}</span>
                    </button>
                  ))}
                </div>

                {/* Deux raccourcis vert sombre */}
                <div className="grid grid-cols-2 gap-2.5 mt-4">
                  {[
                    { Icon: PieChart, label: "Créer un budget", to: "/budgets", speed: 8 },
                    { Icon: Users, label: "Créer une tontine", to: "/tontine", speed: 13 },
                  ].map(({ Icon, label, to, speed }) => (
                    <BorderRotate
                      key={to}
                      tone="lime"
                      animationSpeed={speed}
                      surface="hsl(var(--card))"
                      style={{ borderRadius: 16 }}
                    >
                      <button
                        onClick={() => navigate(to)}
                        className="short-card relative w-full flex items-center gap-2.5 p-2.5 overflow-hidden text-left active:scale-[0.98] transition-transform"
                        style={{
                          borderRadius: 15,
                          background: "linear-gradient(150deg, hsl(var(--primary) / 0.14), hsl(var(--card)) 70%)",
                        }}
                      >
                        <span className="short-icon w-7 h-7 rounded-full flex-none flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.18)" }}>
                          <Icon className="w-3.5 h-3.5 text-primary" strokeWidth={2.1} />
                        </span>
                        <span className="flex-1 min-w-0 text-[11px] leading-tight font-bold text-foreground">{label}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-primary flex-none opacity-80" strokeWidth={2.4} />
                      </button>
                    </BorderRotate>
                  ))}
                </div>
              </div>
            );
            const planBlock = showPlan ? (
              <BudgetAlertBanner key="plan" alerts={budgetAlerts} />
            ) : null;
            const predictionsBlock = showPredictions ? (
              <DashboardPredictions key="predictions" predictions={predictions} formatAmount={formatAmount} />
            ) : null;
            const transactionsBlock = showTransactions ? (
              <div key="transactions" className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">Transactions récentes</h2>
                    {newTxCount > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold"
                      >
                        <Sparkles className="w-3 h-3" />
                        +{newTxCount} nouvelle{newTxCount > 1 ? "s" : ""}
                      </motion.span>
                    )}
                  </div>
                  <Link to="/transactions" className="text-xs font-semibold text-primary">{transactions.length > 0 ? `${transactions.length} ${dateRange.label}` : "Voir tout"} →</Link>
                </div>
                <div className="space-y-2">
                  {recentTx.map((t, i) => (
                    <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                      <BorderRotate className="rounded-xl p-3 flex items-center gap-3" animationSpeed={14}>
                        <div
                          className="category-icon-wrapper"
                          style={{
                            width: 44,
                            height: 44,
                            backgroundColor: (t.categories as any)?.color || (t.type === "income" ? "hsl(var(--primary))" : "#374151"),
                          }}
                        >
                          {getCatIcon((t.categories as any)?.name || "", t.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{t.note || (t.categories as any)?.name || "Transaction"}</p>
                          <p className="text-xs text-muted-foreground">
                            {(t.categories as any)?.name
                              ? (t.categories as any).name
                              : <span className="italic">Non catégorisée</span>}
                            {" · "}{new Date(t.date).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                        <span className={`text-sm font-semibold whitespace-nowrap tabular-nums flex-shrink-0 ${t.type === "income" ? "text-primary" : "text-foreground"}`}>
                          {t.type === "income" ? "+" : "-"}{formatAmount(Number(t.amount))}
                        </span>
                      </BorderRotate>
                    </motion.div>
                  ))}
                  {recentTx.length === 0 && (
                    <EmptyState
                      compact
                      icon={Mic}
                      title="Dis-moi ce que tu as dépensé aujourd'hui."
                      hint="Tu peux aussi écrire à la main."
                      action={{
                        label: "Parler",
                        // Ouvre directement le mode vocal, comme le bouton
                        // « Parler » du trio. Avant, le bouton disait
                        // « Ajouter » et menait au clavier, ce qui
                        // contredisait l'icône et le texte affichés.
                        onClick: () => navigate("/transactions/new", { state: { autoVoice: true } }),
                      }}
                    />
                  )}
                </div>
              </div>
            ) : null;
            const tontinesBlock = showTontines ? (
              <DashboardTontineWidget key="tontines" />
            ) : null;
            const blockMap: Record<BlockKey, React.ReactNode> = {
              wallets: walletsBlock,
              plan: planBlock,
              predictions: predictionsBlock,
              transactions: transactionsBlock,
              tontines: tontinesBlock,
            };
            return blocksOrder.map(k => blockMap[k]);
          })()}

          <Suspense fallback={<ChartSkeleton />}>
            <DashboardCharts
              trendData={trendData}
              chartData={chartData}
              totalExpense={totalExpense}
              formatAmount={formatAmount}
              hasExpenses={transactions.filter(t => t.type === "expense").length > 0}
              trendMode={trendMode}
              setTrendMode={setTrendMode}
              trendModes={trendModes}
            />
           </Suspense>

          {chartData.length === 0 && (
            <div className="glass-card rounded-2xl p-8 mb-6 text-center">
              <p className="text-muted-foreground text-sm">Aucune transaction pour cette période.</p>
              <Link to="/transactions/new" className="text-primary text-sm mt-2 inline-block">Ajouter une transaction →</Link>
            </div>
          )}
        </>
      )}

      {/* Saisir, Parler et Scanner vivent maintenant dans le trio, en haut.
          Seul l'assistant garde son bouton flottant. */}
      <div style={{ bottom: "calc(var(--bottom-nav-space) + 16px)" }} className="fixed right-5 z-50">
        <Link
          to="/assistant"
          aria-label="Ouvrir l'assistant IA"
          className="w-14 h-14 rounded-full gradient-primary neon-glow shadow-lg flex items-center justify-center"
        >
          <MessageCircle className="w-6 h-6 text-primary-foreground" />
        </Link>
      </div>

      <DailyReminderModal
        open={dailyReminder.show}
        onClose={() => setDailyReminder({ show: false, txCount: 0 })}
        txCount={dailyReminder.txCount}
        firstName={profile?.full_name?.split(" ")[0] || ""}
        profileType={profile?.profile_type}
        userId={user?.id}
      />
      <MonthlyBadge
        open={monthlyBadge.show}
        onClose={() => setMonthlyBadge(prev => ({ ...prev, show: false }))}
        badge={monthlyBadge.badge}
        month={monthlyBadge.month}
        savingsRate={monthlyBadge.savingsRate}
      />
    </DashboardLayout>
  );
};

export default Dashboard;
