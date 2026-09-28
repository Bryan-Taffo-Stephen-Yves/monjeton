import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { BorderRotate } from "@/components/ui/animated-gradient-border";
import { Wallet, Plus, TrendingUp, TrendingDown, Pencil, Check, X, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePrivacy } from "@/contexts/PrivacyContext";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { ListItemSkeleton } from "@/components/DashboardSkeleton";
import WalletIcon from "@/components/WalletIcon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WALLET_COLORS: Record<string, string> = {
  "Orange Money": "hsl(25, 95%, 53%)",
  "MTN Mobile Money": "hsl(45, 96%, 58%)",
  "Wave": "hsl(200, 70%, 50%)",
  "Moov Money": "hsl(var(--muted-foreground))",
  "Cash": "hsl(var(--primary))",
};

const Wallets = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatAmount } = usePrivacy();
  const [wallets, setWallets] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, { income: number; expense: number }>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newInitialBalance, setNewInitialBalance] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState("");

  // Transfer state
  const [showTransfer, setShowTransfer] = useState(false);
  const [fromWalletId, setFromWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferring, setTransferring] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [walletsRes, txRes] = await Promise.all([
        supabase.from("wallets").select("*").eq("user_id", user.id),
        supabase.from("transactions").select("wallet_id, type, amount").eq("user_id", user.id),
      ]);
      if (walletsRes.error) throw walletsRes.error;
      if (txRes.error) throw txRes.error;

      setWallets(walletsRes.data || []);

      const bal: Record<string, { income: number; expense: number }> = {};
      (txRes.data || []).forEach((t: any) => {
        if (!t.wallet_id) return;
        if (!bal[t.wallet_id]) bal[t.wallet_id] = { income: 0, expense: 0 };
        if (t.type === "income") bal[t.wallet_id].income += Number(t.amount);
        else bal[t.wallet_id].expense += Number(t.amount);
      });
      setBalances(bal);
    } catch (err: any) {
      setError(err.message || "Erreur de chargement");
      toast({ title: "Erreur de chargement", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const getWalletSolde = (w: any) => {
    const b = balances[w.id] || { income: 0, expense: 0 };
    const initBal = Number(w.initial_balance) || 0;
    return initBal + b.income - b.expense;
  };

  const handleAdd = async () => {
    if (!newName.trim() || !user) return;
    const initBal = parseFloat(newInitialBalance) || 0;
    await supabase.from("wallets").insert({ user_id: user.id, wallet_name: newName, initial_balance: initBal } as any);
    toast({ title: "Portefeuille ajouté ✅" });
    setNewName("");
    setNewInitialBalance("");
    setShowAdd(false);
    fetchData();
  };

  const handleUpdateBalance = async (id: string) => {
    const val = parseFloat(editBalance);
    if (isNaN(val)) return;
    await supabase.from("wallets").update({ initial_balance: val } as any).eq("id", id);
    toast({ title: "Solde initial mis à jour ✅" });
    setEditingId(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    // Vérifier les transactions liées
    const { count, error: countErr } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("wallet_id", id);
    if (countErr) {
      toast({ title: "Suppression impossible", description: countErr.message, variant: "destructive" });
      return;
    }
    if ((count || 0) > 0) {
      toast({
        title: "Portefeuille non vide",
        description: `Ce portefeuille contient ${count} transaction${count! > 1 ? "s" : ""}. Supprime ou déplace-les d'abord.`,
        variant: "destructive",
      });
      return;
    }
    const { data, error } = await supabase.from("wallets").delete().eq("id", id).select();
    if (error) {
      toast({ title: "Suppression impossible", description: error.message, variant: "destructive" });
      return;
    }
    if (!data || data.length === 0) {
      toast({ title: "Suppression impossible", description: "Tu n'as peut-être pas les droits.", variant: "destructive" });
      return;
    }
    toast({ title: "Portefeuille supprimé" });
    fetchData();
  };

  const handleTransfer = async () => {
    if (!user || !fromWalletId || !toWalletId || fromWalletId === toWalletId) return;
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }

    const fromWallet = wallets.find(w => w.id === fromWalletId);
    const toWallet = wallets.find(w => w.id === toWalletId);
    if (!fromWallet || !toWallet) return;

    const fromSolde = getWalletSolde(fromWallet);
    if (amount > fromSolde) {
      toast({ title: "Solde insuffisant", description: `Le solde de ${fromWallet.wallet_name} est de ${formatAmount(fromSolde)}`, variant: "destructive" });
      return;
    }

    setTransferring(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      // Fetch or create 'Transfert' category
      let transferCatId: string | null = null;
      const { data: existingCat } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", "Transfert")
        .maybeSingle();

      if (existingCat) {
        transferCatId = existingCat.id;
      } else {
        const { data: newCat } = await supabase
          .from("categories")
          .insert({ user_id: user.id, name: "Transfert", icon: "ArrowRightLeft", color: "hsl(200,70%,50%)", type: "expense" } as any)
          .select("id")
          .single();
        transferCatId = newCat?.id || null;
      }

      // Create two transactions: expense from source, income to destination
      const { error } = await supabase.from("transactions").insert([
        {
          user_id: user.id,
          type: "expense",
          amount,
          date: today,
          note: `Transfert vers ${toWallet.wallet_name}`,
          wallet_id: fromWalletId,
          category_id: transferCatId,
          source: "transfer",
        },
        {
          user_id: user.id,
          type: "income",
          amount,
          date: today,
          note: `Transfert depuis ${fromWallet.wallet_name}`,
          wallet_id: toWalletId,
          category_id: transferCatId,
          source: "transfer",
        },
      ]);

      if (error) throw error;

      toast({ title: "Transfert effectué ✅", description: `${formatAmount(amount)} de ${fromWallet.wallet_name} → ${toWallet.wallet_name}` });
      setShowTransfer(false);
      setTransferAmount("");
      setFromWalletId("");
      setToWalletId("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Erreur de transfert", description: err.message, variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  return (
    <DashboardLayout title="Portefeuilles">
      <div className="space-y-3 mb-4">
        {error ? (
          <div className="glass-card rounded-2xl p-6 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="glass" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" /> Réessayer
            </Button>
          </div>
        ) : loading
          ? Array.from({ length: 4 }).map((_, i) => <ListItemSkeleton key={i} />)
          : wallets.map((w, i) => {
            const color = WALLET_COLORS[w.wallet_name] || "hsl(200, 70%, 50%)";
            const b = balances[w.id] || { income: 0, expense: 0 };
            const initBal = Number(w.initial_balance) || 0;
            const solde = initBal + b.income - b.expense;
            const isEditing = editingId === w.id;
            return (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <BorderRotate className="p-4 space-y-2" animationSpeed={18}>
                <div className="flex items-center gap-4">
                  <WalletIcon name={w.wallet_name} size={48} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{w.wallet_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {solde >= 0 ? (
                        <TrendingUp className="w-3 h-3 text-primary" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-destructive" />
                      )}
                      <span className={`text-sm font-semibold whitespace-nowrap tabular-nums ${solde >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatAmount(solde)}
                      </span>
                    </div>
                  </div>
                  <ConfirmDeleteDialog onConfirm={() => handleDelete(w.id)} title="Supprimer ce portefeuille ?" />
                </div>
                {/* Initial balance row */}
                <div className="flex items-center justify-between pl-16 text-xs text-muted-foreground">
                  <span>Solde initial : {isEditing ? "" : `${formatAmount(initBal)}`}</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <MoneyInput
                        value={editBalance}
                        onChange={(n) => setEditBalance(n ? String(n) : "")}
                        showCurrency={false}
                        className="w-28 [&>input]:h-7 [&>input]:text-xs [&>input]:bg-secondary [&>input]:border-border"
                        autoFocus
                      />
                      <button onClick={() => handleUpdateBalance(w.id)} className="text-primary hover:text-primary/80"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingId(w.id); setEditBalance(String(initBal)); }}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {(w.wallet_name === "Carte bancaire" || w.wallet_name === "Carte Bancaire") && (
                  <p className="text-[11px] text-muted-foreground/80 italic pl-16">
                    Solde manuel — sera pas mis à jour automatiquement
                  </p>
                )}
                <p className="text-xs text-muted-foreground pl-16">
                  +{formatAmount(b.income)} / -{formatAmount(b.expense)}
                </p>
                </BorderRotate>
              </motion.div>
            );
          })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        {!showAdd && (
          <>
            <Button variant="glass" size="lg" className="flex-1 text-sm" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4" /> Ajouter
            </Button>
            {wallets.length >= 2 && (
              <Button variant="glass" size="lg" className="flex-1 text-sm" onClick={() => setShowTransfer(true)}>
                <ArrowRightLeft className="w-4 h-4" /> Transférer
              </Button>
            )}
          </>
        )}
      </div>

      {showAdd && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-4 space-y-3">
          <Input placeholder="Nom du portefeuille" value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-secondary border-border" />
          <MoneyInput placeholder="Solde initial (ex: 50 000)" value={newInitialBalance} onChange={(n) => setNewInitialBalance(n ? String(n) : "")} showCurrency={false} className="[&>input]:bg-secondary [&>input]:border-border" />
          {newName.trim().toLowerCase().includes("carte") && (
            <p className="text-[11px] text-muted-foreground/80 italic">
              Solde manuel — sera pas mis à jour automatiquement
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="glass" onClick={() => setShowAdd(false)} className="flex-1">Annuler</Button>
            <Button variant="hero" onClick={handleAdd} className="flex-1">Ajouter</Button>
          </div>
        </motion.div>
      )}

      {/* Transfer Dialog */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent aria-describedby={undefined} className="glass-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              Transfert entre portefeuilles
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">De</label>
              <Select value={fromWalletId} onValueChange={setFromWalletId}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Portefeuille source" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.filter(w => w.id !== toWalletId).map(w => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.wallet_name} ({formatAmount(getWalletSolde(w))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Vers</label>
              <Select value={toWalletId} onValueChange={setToWalletId}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Portefeuille destination" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.filter(w => w.id !== fromWalletId).map(w => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.wallet_name} ({formatAmount(getWalletSolde(w))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Montant (F CFA)</label>
              <MoneyInput
                placeholder="Ex: 5 000"
                value={transferAmount}
                onChange={(n) => setTransferAmount(n ? String(n) : "")}
                showCurrency={false}
                className="[&>input]:bg-secondary [&>input]:border-border"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="glass" onClick={() => setShowTransfer(false)} className="flex-1" disabled={transferring}>
                Annuler
              </Button>
              <Button
                variant="hero"
                onClick={handleTransfer}
                className="flex-1"
                disabled={transferring || !fromWalletId || !toWalletId || !transferAmount}
              >
                {transferring ? "Transfert..." : "Confirmer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Wallets;
