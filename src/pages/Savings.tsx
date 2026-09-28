import { useState, useEffect, useCallback } from "react";
import { UserText } from "@/components/UserText";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { BorderRotate } from "@/components/ui/animated-gradient-border";
import { Target, Plus, ChevronDown, ChevronUp, ArrowDownToLine, PartyPopper, Wallet } from "lucide-react";
import { GoalIcon } from "@/lib/goalIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Screen } from "@/components/layout/Screen";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { CardSkeleton } from "@/components/DashboardSkeleton";
import { formatMoneySmart } from "@/lib/formatMoney";
import confetti from "canvas-confetti";
import { DatePickerField } from "@/components/ui/DatePickerField";

interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  created_at: string;
  emoji: string | null;
  note: string | null;
  currency: string | null;
}

interface Deposit {
  id: string;
  amount: number;
  created_at: string;
  wallet_id: string | null;
}

interface WalletItem {
  id: string;
  wallet_name: string;
}

const TEMPLATES = [
  { icon: "phone", name: "Nouveau téléphone", amount: 150000 },
  { icon: "home", name: "Loyer", amount: 75000 },
  { icon: "school", name: "Formation", amount: 200000 },
  { icon: "savings", name: "Fonds d'urgence", amount: 100000 },
];

// Le choix d'icônes vit désormais dans @/lib/goalIcons (ICON_CHOICES).

const Savings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);

  // Deposit states
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositWalletId, setDepositWalletId] = useState("");
  const [wallets, setWallets] = useState<WalletItem[]>([]);

  // History states
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<Record<string, Deposit[]>>({});

  // Confetti fired tracker
  const [confettiFired, setConfettiFired] = useState<Set<string>>(new Set());

  const fetchGoals = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setGoals((data as SavingsGoal[]) || []);
    } catch {
      toast({ title: "Erreur de chargement", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const fetchWallets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("wallets")
      .select("id, wallet_name")
      .eq("user_id", user.id);
    setWallets((data as WalletItem[]) || []);
  }, [user]);

  const fetchDeposits = async (goalId: string) => {
    const { data } = await supabase
      .from("savings_deposits")
      .select("id, amount, created_at, wallet_id")
      .eq("savings_goal_id", goalId)
      .order("created_at", { ascending: false })
      .limit(3);
    setDeposits(prev => ({ ...prev, [goalId]: (data as Deposit[]) || [] }));
  };

  useEffect(() => {
    fetchGoals();
    fetchWallets();
  }, [fetchGoals, fetchWallets]);

  useEffect(() => {
    goals.forEach(g => {
      if (g.current_amount >= g.target_amount && g.target_amount > 0 && !confettiFired.has(g.id)) {
        setConfettiFired(prev => new Set(prev).add(g.id));
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      }
    });
  }, [goals, confettiFired]);

  const resetForm = () => {
    setEditingGoalId(null);
    setName("");
    setTarget("");
    setDeadline("");
    setNote("");
    setShowMore(false);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openTemplateModal = (t: typeof TEMPLATES[number]) => {
    resetForm();
    setName(t.name);
    setTarget(String(t.amount));
    setModalOpen(true);
  };

  const openEditModal = (g: SavingsGoal) => {
    setEditingGoalId(g.id);
    setName(g.name);
    setTarget(String(g.target_amount));
    setDeadline(g.deadline || "");
    setNote(g.note || "");
    setShowMore(Boolean(g.deadline || g.note));
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const trimmedName = name.trim();
    const goalTarget = Number(target);
    if (!trimmedName) {
      toast({ title: "Nom requis", variant: "destructive" });
      return;
    }
    if (!goalTarget || goalTarget <= 0) {
      toast({ title: "Montant cible invalide", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: trimmedName.slice(0, 50),
        emoji: "target",
        target_amount: goalTarget,
        deadline: deadline || null,
        note: note ? note.slice(0, 200) : null,
      };
      if (editingGoalId) {
        const { error } = await supabase
          .from("savings_goals")
          .update(payload)
          .eq("id", editingGoalId);
        if (error) throw error;
        toast({ title: "Objectif mis à jour" });
      } else {
        const { error } = await supabase.from("savings_goals").insert({
          user_id: user.id,
          ...payload,
        });
        if (error) throw error;
        toast({ title: "Objectif créé" });
      }
      setModalOpen(false);
      resetForm();
      fetchGoals();
    } catch {
      toast({ title: "Erreur d'enregistrement", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeposit = async (goalId: string, currentAmount: number, targetAmount: number) => {
    const val = parseFloat(depositAmount);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }
    if (currentAmount + val > targetAmount) {
      toast({ title: "Dépassement", description: `Max ${formatMoneySmart(targetAmount - currentAmount)} restants`, variant: "destructive" });
      return;
    }
    if (!depositWalletId) {
      toast({ title: "Sélectionne un portefeuille", variant: "destructive" });
      return;
    }
    if (!user) return;

    try {
      let { data: catData } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", "Épargne")
        .maybeSingle();

      let categoryId = catData?.id;
      if (!categoryId) {
        const { data: newCat } = await supabase
          .from("categories")
          .insert({ user_id: user.id, name: "Épargne", type: "expense", icon: "PiggyBank", color: "hsl(160,60%,45%)" })
          .select("id")
          .single();
        categoryId = newCat?.id;
      }

      const { data: txData, error: txErr } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type: "expense",
          amount: val,
          category_id: categoryId,
          wallet_id: depositWalletId,
          note: `Épargne : ${goals.find(g => g.id === goalId)?.name}`,
          date: new Date().toISOString().split("T")[0],
          source: "transfer",
        })
        .select("id")
        .single();
      if (txErr) throw txErr;

      const { error: depErr } = await supabase
        .from("savings_deposits")
        .insert({
          savings_goal_id: goalId,
          user_id: user.id,
          wallet_id: depositWalletId,
          amount: val,
          transaction_id: txData?.id,
        });
      if (depErr) throw depErr;

      const { error: upErr } = await supabase
        .from("savings_goals")
        .update({ current_amount: currentAmount + val })
        .eq("id", goalId);
      if (upErr) throw upErr;

      toast({ title: `${formatMoneySmart(val)} versés` });
      setDepositGoalId(null);
      setDepositAmount("");
      setDepositWalletId("");
      fetchGoals();
      fetchDeposits(goalId);
    } catch {
      toast({ title: "Erreur de versement", variant: "destructive" });
    }
  };

  const handleWithdraw = async (goal: SavingsGoal) => {
    if (!user || wallets.length === 0) return;
    try {
      const { error: txErr } = await supabase.from("transactions").insert({
        user_id: user.id,
        type: "income",
        amount: goal.current_amount,
        wallet_id: wallets[0].id,
        note: `Retrait épargne : ${goal.name}`,
        date: new Date().toISOString().split("T")[0],
        source: "transfer",
      });
      if (txErr) throw txErr;

      await supabase.from("savings_goals").update({ current_amount: 0 }).eq("id", goal.id);
      toast({ title: `${formatMoneySmart(goal.current_amount)} retirés vers ${wallets[0].wallet_name}` });
      fetchGoals();
    } catch {
      toast({ title: "Erreur de retrait", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { data, error } = await supabase.from("savings_goals").delete().eq("id", id).select();
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({
          title: "Suppression impossible",
          description: "Tu n'as peut-être pas les droits.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Objectif supprimé" });
      fetchGoals();
    } catch {
      toast({ title: "Erreur de suppression", variant: "destructive" });
    }
  };

  /**
   * Rythme d'épargne à tenir pour atteindre l'objectif à temps.
   *
   * On raisonne par MOIS quand l'échéance est lointaine : personne
   * n'épargne 1 850 F par jour, on met 55 000 F en fin de mois.
   * Par jour seulement dans la dernière ligne droite.
   */
  const getPace = (g: SavingsGoal) => {
    if (!g.deadline) return null;
    const remaining = g.target_amount - g.current_amount;
    if (remaining <= 0) return null;
    const daysLeft = Math.ceil((new Date(g.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) return null;

    if (daysLeft >= 45) {
      const monthsLeft = Math.max(1, Math.round(daysLeft / 30));
      return { amount: Math.ceil(remaining / monthsLeft), unit: "par mois" as const, daysLeft };
    }
    if (daysLeft >= 14) {
      const weeksLeft = Math.max(1, Math.round(daysLeft / 7));
      return { amount: Math.ceil(remaining / weeksLeft), unit: "par semaine" as const, daysLeft };
    }
    return { amount: Math.ceil(remaining / daysLeft), unit: "par jour" as const, daysLeft };
  };

  const toggleHistory = (goalId: string) => {
    if (expandedGoalId === goalId) {
      setExpandedGoalId(null);
    } else {
      setExpandedGoalId(goalId);
      if (!deposits[goalId]) fetchDeposits(goalId);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <DashboardLayout title="Épargne">
      {!loading && goals.length > 0 && (
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Mes objectifs</p>
          <Button size="sm" variant="ghost" onClick={openCreateModal} className="h-7 px-2 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Nouveau
          </Button>
        </div>
      )}
      <div className="space-y-3 mb-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          goals.map((g, i) => {
            const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
            const remaining = Math.max(g.target_amount - g.current_amount, 0);
            const daysLeft = g.deadline
              ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;
            const pace = getPace(g);
            const isAchieved = g.current_amount >= g.target_amount && g.target_amount > 0;
            const goalDeposits = deposits[g.id] || [];

            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * i }}
              >
                <BorderRotate className="p-4" animationSpeed={18}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${isAchieved ? "bg-green-500/20" : "bg-primary/20"}`}>
                      {isAchieved ? <PartyPopper className="w-5 h-5 text-primary" /> : <GoalIcon value={g.emoji} className="w-5 h-5 text-primary" />}
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditModal(g)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-sm font-medium text-foreground truncate"><UserText>{g.name}</UserText></p>
                      {g.deadline && (
                        <p className="text-xs text-muted-foreground">
                          Échéance : {new Date(g.deadline).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </button>
                    <span className="text-sm font-bold text-primary">{pct}%</span>
                    <ConfirmDeleteDialog onConfirm={() => handleDelete(g.id)} title="Supprimer cet objectif ?" />
                  </div>

                  {g.note && (
                    <p className="text-xs text-muted-foreground mb-3 italic line-clamp-2">{g.note}</p>
                  )}

                  {isAchieved && (
                    <Badge className="mb-3 bg-green-500/20 text-green-500 border-green-500/30">
                      Objectif atteint
                    </Badge>
                  )}

                  <Progress value={Math.min(pct, 100)} className="h-2 bg-secondary" />
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-muted-foreground">{formatMoneySmart(g.current_amount)}</span>
                    <span className="text-xs text-muted-foreground">{formatMoneySmart(g.target_amount)}</span>
                  </div>

                  {!isAchieved && (
                    <div className="mt-3">
                      {pace ? (
                        <div
                          className="rounded-xl px-3.5 py-3"
                          style={{
                            background: "linear-gradient(150deg, hsl(var(--primary) / 0.12), hsl(var(--card)) 72%)",
                            border: "1px solid hsl(var(--primary) / 0.2)",
                          }}
                        >
                          <p className="text-[14px] font-semibold leading-relaxed text-foreground">
                            Mets{" "}
                            <span className="font-extrabold text-primary tabular-nums">
                              {formatMoneySmart(pace.amount)}
                            </span>{" "}
                            {pace.unit} pour y arriver avant le{" "}
                            {new Date(g.deadline!).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "long",
                            })}
                            .
                          </p>
                          <p className="mt-1.5 text-[11.5px] font-medium text-muted-foreground">
                            Il reste {formatMoneySmart(remaining)} à réunir
                            {pace.daysLeft > 0 && ` · ${pace.daysLeft} jour${pace.daysLeft > 1 ? "s" : ""}`}
                          </p>
                        </div>
                      ) : daysLeft !== null && daysLeft <= 0 ? (
                        <div
                          className="rounded-xl px-3.5 py-3"
                          style={{
                            background: "linear-gradient(150deg, hsl(var(--destructive) / 0.14), hsl(var(--card)) 72%)",
                            border: "1px solid hsl(var(--destructive) / 0.26)",
                          }}
                        >
                          <p className="text-[14px] font-semibold text-foreground">
                            Échéance dépassée — il manque{" "}
                            <span className="font-extrabold text-destructive tabular-nums">
                              {formatMoneySmart(remaining)}
                            </span>
                            .
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Reste :{" "}
                          <span className="font-medium text-foreground">
                            {formatMoneySmart(remaining)}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  <AnimatePresence>
                    {depositGoalId === g.id ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 space-y-2 pt-3 border-t border-border">
                          <MoneyInput
                            placeholder="Montant à verser"
                            value={depositAmount}
                            onChange={(n) => setDepositAmount(n ? String(n) : "")}
                            showCurrency={false}
                            className="[&>input]:bg-secondary [&>input]:border-border"
                            autoFocus
                          />
                          <Select value={depositWalletId} onValueChange={setDepositWalletId}>
                            <SelectTrigger className="bg-secondary border-border">
                              <SelectValue placeholder="Depuis quel portefeuille ?" />
                            </SelectTrigger>
                            <SelectContent>
                              {wallets.map(w => (
                                <SelectItem key={w.id} value={w.id}>
                                  <div className="flex items-center gap-2">
                                    <Wallet className="w-3.5 h-3.5" />
                                    {w.wallet_name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" className="flex-1" onClick={() => { setDepositGoalId(null); setDepositAmount(""); setDepositWalletId(""); }}>
                              Annuler
                            </Button>
                            <Button size="sm" variant="hero" className="flex-1" onClick={() => handleDeposit(g.id, g.current_amount, g.target_amount)}>
                              Verser
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ) : isAchieved ? (
                      <Button variant="glass" size="sm" className="w-full mt-3" onClick={() => handleWithdraw(g)}>
                        <ArrowDownToLine className="w-4 h-4 mr-1" /> Retirer les fonds
                      </Button>
                    ) : (
                      <Button variant="glass" size="sm" className="w-full mt-3" onClick={() => { setDepositGoalId(g.id); if (wallets.length === 1) setDepositWalletId(wallets[0].id); }}>
                        + Verser un montant
                      </Button>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={() => toggleHistory(g.id)}
                    className="w-full flex items-center justify-center gap-1 mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Historique
                    {expandedGoalId === g.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <AnimatePresence>
                    {expandedGoalId === g.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 space-y-1.5">
                          {goalDeposits.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">Aucun versement</p>
                          ) : (
                            goalDeposits.map(d => (
                              <div key={d.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-secondary/50">
                                <span className="text-muted-foreground">
                                  {new Date(d.created_at).toLocaleDateString("fr-FR")}
                                </span>
                                <span className="font-medium text-foreground">+{formatMoneySmart(d.amount)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </BorderRotate>
              </motion.div>
            );
          })
        )}
      </div>

      {!loading && goals.length === 0 && (
        <div className="space-y-3">
          <div className="text-center py-4">
            <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
              <Target className="h-7 w-7 text-primary" />
            </span>
            <p className="font-semibold text-foreground mb-1">Commence à épargner</p>
            <p className="text-sm text-muted-foreground">Choisis une suggestion ou crée le tien</p>
          </div>

          <p className="text-xs uppercase tracking-wide text-muted-foreground px-1">
            Suggestions
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => openTemplateModal(t)}
                className="flex flex-col justify-between gap-3.5 p-4 min-h-[134px] rounded-2xl bg-card border border-border hover:bg-secondary/60 transition-colors text-left"
              >
                <span className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-none">
                  <GoalIcon value={t.icon} className="w-5 h-5 text-primary" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-bold text-foreground leading-tight">
                    {t.name}
                  </span>
                  <span className="block mt-1.5 text-[13.5px] font-extrabold text-primary">
                    {formatMoneySmart(t.amount)}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={openCreateModal}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-2 border-dashed border-primary/40 text-primary font-medium hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer un objectif personnalisé
          </button>
        </div>
      )}

      {/* ─── CREATE/EDIT MODAL ─── */}
      <Dialog
        open={modalOpen}
        onOpenChange={(o) => {
          setModalOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent aria-describedby={undefined} className="p-0 max-w-md max-h-[90vh] overflow-hidden flex flex-col">
          <Screen hasBottomNav={false} className="flex-1 min-h-0">
            <Screen.Header className="px-5 pt-5 pb-3 border-b border-border">
              <DialogHeader>
                <DialogTitle>
                  {editingGoalId ? "Modifier l'objectif" : "Nouvel objectif"}
                </DialogTitle>
              </DialogHeader>
            </Screen.Header>

            <Screen.Content className="overflow-y-auto px-5 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nom de l'objectif</Label>
                <Input
                  placeholder="Ex : Voyage à Dubaï"
                  value={name}
                  maxLength={50}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-secondary border-border"
                  autoFocus
                />
                <p className="text-[10px] text-muted-foreground text-right">{name.length}/50</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Montant cible</Label>
                <MoneyInput
                  placeholder="Combien veux-tu atteindre ?"
                  value={target}
                  onChange={(n) => setTarget(n ? String(n) : "")}
                  showCurrency={false}
                  className="[&>input]:bg-secondary [&>input]:border-border"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowMore((s) => !s)}
                className="w-full flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-3.5 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <span>{showMore ? "Moins de détails" : "+ Ajouter des détails"}</span>
                {showMore ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              <AnimatePresence>
                {showMore && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div className="space-y-1.5">
                      <Label className="text-xs">Date d'échéance (optionnel)</Label>
                      <DatePickerField value={deadline} onChange={(v) => setDeadline(v)} min={today} className="bg-secondary border-border" />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Note (optionnel)</Label>
                      <Textarea
                        placeholder="Pourquoi cet objectif ?"
                        value={note}
                        maxLength={200}
                        onChange={(e) => setNote(e.target.value)}
                        className="bg-secondary border-border resize-none"
                        rows={3}
                      />
                      <p className="text-[10px] text-muted-foreground text-right">{note.length}/200</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Screen.Content>

            <Screen.StickyAction>
              <div className="flex gap-2">
                <Button
                  variant="glass"
                  className="flex-1"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Annuler
                </Button>
                <Button
                  variant="hero"
                  className="flex-1"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {editingGoalId ? "Enregistrer" : "Créer"}
                </Button>
              </div>
            </Screen.StickyAction>
          </Screen>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Savings;
