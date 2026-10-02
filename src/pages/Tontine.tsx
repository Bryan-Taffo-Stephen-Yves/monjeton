import { useState, useEffect, useCallback, useMemo } from "react";
import { UserText } from "@/components/UserText";

import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { BorderRotate } from "@/components/ui/animated-gradient-border";
import { Plus, Users, ChevronLeft, ChevronRight, CheckCircle, CheckCircle2, Clock, AlertTriangle, Lock, Crown, ChevronDown, ChevronUp, FileText, MessageCircle, PauseCircle, PlayCircle, XCircle, AlertCircle, Calendar, Bell, ShieldAlert, MoreVertical, UserX, RotateCcw, Ban, Pencil, Link2, Target, Building2, RefreshCw, Wallet, Undo2, Hand, Settings, Mail, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import EditCaisseModal from "@/components/tontine/EditCaisseModal";
import InviteCaisseModal from "@/components/caisse/InviteCaisseModal";
import CaisseCollaborators from "@/components/tontine/CaisseCollaborators";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { sendWhatsAppTontine, notifyAllUnpaid, logNotification } from "@/lib/tontineNotifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { ListItemSkeleton } from "@/components/DashboardSkeleton";
import CreateTontineModal from "@/components/tontine/CreateTontineModal";
import ReportsTab from "@/components/tontine/ReportsTab";
import TontineHistory from "@/components/tontine/TontineHistory";
import ProjectCaisseView from "@/components/tontine/ProjectCaisseView";
import LeaveCaisseButton from "@/components/tontine/LeaveCaisseButton";
import { TontineData, TontineMember, TontineCycle, TontinePayment, FREQ_LABELS, FREQ_BADGE_CLASSES } from "@/components/tontine/types";
import { fmt, generateCycleInfo } from "@/components/tontine/utils";
import { DatePickerField } from "@/components/ui/DatePickerField";

type MemberStatus = {
  member: TontineMember;
  totalPaid: number;
  expected: number;
  status: "paid" | "partial" | "pending";
  lastDate?: string;
};

const TontinePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"active" | "closed" | "all">("active");
  /**
   * Séparation Caisses / Tontines.
   * Une tontine fait tourner un tour entre membres (caisse_type par défaut).
   * Une caisse collecte vers un objectif : "project" (événement) ou
   * "association" (groupe). Les mélanger obligeait à lire un badge sur
   * chaque carte pour savoir de quoi il s'agit.
   */
  const [familyFilter, setFamilyFilter] = useState<"caisses" | "tontines">("caisses");
  const [tontines, setTontines] = useState<TontineData[]>([]);
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // Detail view
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<TontineMember[]>([]);
  const [openCycle, setOpenCycle] = useState<TontineCycle | null>(null);
  const [closedCycles, setClosedCycles] = useState<TontineCycle[]>([]);
  const [payments, setPayments] = useState<TontinePayment[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [cycleMap, setCycleMap] = useState<Record<string, { total_expected: number; total_collected: number; period_label: string }>>({});

  // Payment modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMember, setPayMember] = useState<TontineMember | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Add-member modal (from detail view)
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  // History & Reports
  const [showHistory, setShowHistory] = useState(false);
  const [showReports, setShowReports] = useState(false);

  // Detail tabs (members / calendar / notifications)
  const [detailTab, setDetailTab] = useState<"membres" | "calendrier" | "notifs">("membres");

  // Close confirmation dialog
  const [showCloture, setShowCloture] = useState(false);

  // Member actions sheet
  const [memberActionOpen, setMemberActionOpen] = useState(false);
  const [actionMember, setActionMember] = useState<TontineMember | null>(null);
  const [showRemovedMembers, setShowRemovedMembers] = useState(false);
  const [memberHistory, setMemberHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [editCaisseOpen, setEditCaisseOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const selected = tontines.find(t => t.id === selectedId);

  // Owner check via roleMap (collaborator role) with fallback to user_id ownership
  const currentRole = useMemo<string>(() => {
    if (!selected || !user) return "viewer";
    return roleMap[selected.id] || (selected.user_id === user.id ? "owner" : "viewer");
  }, [selected, user, roleMap]);
  const isOwner = currentRole === "owner";
  const canManage = currentRole === "owner" || currentRole === "manager";
  const isActive = (selected?.status || "active") === "active";
  const isPaused = (selected?.status || "") === "paused" || (selected?.status || "") === "pausee";
  const isClosed = (selected?.status || "") === "closed" || (selected?.status || "") === "terminee";

  const loadTontines = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // RLS "Collaborators view tontine" already returns caisses where user is owner OR collaborator
    const { data } = await supabase
      .from("tontines")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (data || []) as unknown as TontineData[];
    setTontines(list);
    setLoading(false);

    if (list.length > 0) {
      const ids = list.map(t => t.id);
      const [cyclesRes, membersRes, collabsRes] = await Promise.all([
        supabase.from("tontine_cycles").select("tontine_id, total_expected, total_collected, period_label").in("tontine_id", ids).eq("status", "open"),
        supabase.from("tontine_members").select("tontine_id").in("tontine_id", ids),
        supabase.from("caisse_collaborators" as any).select("caisse_id, role").eq("user_id", user.id).in("caisse_id", ids),
      ]);
      const cMap: Record<string, { total_expected: number; total_collected: number; period_label: string }> = {};
      ((cyclesRes.data || []) as any[]).forEach(c => { cMap[c.tontine_id] = c; });
      setCycleMap(cMap);
      const mMap: Record<string, number> = {};
      ((membersRes.data || []) as any[]).forEach(m => { mMap[m.tontine_id] = (mMap[m.tontine_id] || 0) + 1; });
      setMemberCounts(mMap);
      const rMap: Record<string, string> = {};
      ((collabsRes.data || []) as any[]).forEach(c => { rMap[c.caisse_id] = c.role; });
      setRoleMap(rMap);
    } else {
      setRoleMap({});
    }
  }, [user]);

  const loadDetail = useCallback(async (tontineId: string) => {
    const [mRes, cRes] = await Promise.all([
      supabase.from("tontine_members").select("*").eq("tontine_id", tontineId),
      supabase.from("tontine_cycles").select("*").eq("tontine_id", tontineId).order("cycle_number", { ascending: true }),
    ]);
    const allMembers = (mRes.data || []) as unknown as TontineMember[];
    const allCycles = (cRes.data || []) as unknown as TontineCycle[];
    setMembers(allMembers);
    const open = allCycles.find(c => c.status === "open") || null;
    setOpenCycle(open);
    setClosedCycles(allCycles.filter(c => c.status === "closed"));

    if (open) {
      const pRes = await supabase.from("tontine_payments").select("*").eq("cycle_id", open.id);
      setPayments((pRes.data || []) as unknown as TontinePayment[]);
    } else {
      setPayments([]);
    }
  }, []);

  useEffect(() => { loadTontines(); }, [loadTontines]);

  // Global realtime: when current user is added/removed/role-changed as collaborator anywhere,
  // refresh the list so removed caisses disappear immediately (and possibly redirect).
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`my-collabs-${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "caisse_collaborators", filter: `user_id=eq.${user.id}` },
        () => { loadTontines(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, loadTontines]);

  // If user is currently viewing a caisse they just lost access to, kick them back to the list.
  useEffect(() => {
    if (loading) return;
    if (selectedId && !tontines.find(t => t.id === selectedId)) {
      setSelectedId(null);
      toast({ title: "Accès retiré", description: "Tu n'as plus accès à cette tontine.", variant: "destructive" });
    }
  }, [tontines, selectedId, loading]);

  useEffect(() => {
    if (!selectedId || selected?.caisse_type === "project") return;
    const channel = supabase
      .channel(`tontine-${selectedId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "tontine_members", filter: `tontine_id=eq.${selectedId}` },
        () => loadDetail(selectedId))
      .on("postgres_changes",
        { event: "*", schema: "public", table: "tontine_cycles", filter: `tontine_id=eq.${selectedId}` },
        () => loadDetail(selectedId))
      .on("postgres_changes",
        { event: "*", schema: "public", table: "tontine_payments" },
        () => loadDetail(selectedId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedId, selected?.caisse_type, loadDetail]);

  const openDetail = (id: string) => {
    setSelectedId(id);
    setShowHistory(false);
    loadDetail(id);
  };

  const goBack = () => {
    setSelectedId(null);
    setMembers([]);
    setOpenCycle(null);
    setClosedCycles([]);
    setPayments([]);
    loadTontines();
  };

  // Member statuses for current cycle
  const visibleMembers = useMemo(
    () => showRemovedMembers ? members : members.filter(m => m.status !== "removed"),
    [members, showRemovedMembers]
  );
  const inactiveCount = useMemo(
    () => members.filter(m => m.status === "removed" || m.status === "suspended").length,
    [members]
  );

  const getMemberStatuses = (): MemberStatus[] => {
    if (!selected) return [];
    return visibleMembers.map(m => {
      const isSuspended = m.status === "suspended";
      const isRemoved = m.status === "removed";
      const mPayments = openCycle ? payments.filter(p => p.member_id === m.id) : [];
      const totalPaid = mPayments.reduce((s, p) => s + Number(p.amount_paid), 0);
      const lastDate = mPayments.length > 0 ? mPayments[mPayments.length - 1].payment_date : undefined;

      if (isSuspended || isRemoved) {
        return {
          member: m,
          totalPaid,
          expected: 0,
          status: (totalPaid > 0 ? "paid" : "pending") as "paid" | "pending",
          lastDate,
        };
      }
      const expected = selected.contribution_amount;
      let status: "paid" | "partial" | "pending" = "pending";
      if (totalPaid >= expected) status = "paid";
      else if (totalPaid > 0) status = "partial";
      return { member: m, totalPaid, expected, status, lastDate };
    });
  };

  const statuses = getMemberStatuses();
  const activeStatuses = statuses.filter(s => s.member.status === "active" || !s.member.status);
  const paidCount = activeStatuses.filter(s => s.status === "paid").length;
  const allPaid = activeStatuses.length > 0 && paidCount === activeStatuses.length;
  const cyclePct = openCycle && openCycle.total_expected > 0
    ? Math.round((openCycle.total_collected / openCycle.total_expected) * 100) : 0;

  const loadMemberHistory = async (memberId: string) => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from("tontine_member_history" as any)
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(10);
    setMemberHistory((data as any[]) || []);
    setHistoryLoading(false);
  };

  const performMemberAction = async (
    newStatus: "active" | "suspended" | "removed",
    member: TontineMember,
    historyAction: string
  ) => {
    if (!selected || !canManage) return false;
    const { error } = await supabase
      .from("tontine_members" as any)
      .update({ status: newStatus } as any)
      .eq("id", member.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return false;
    }
    await supabase.from("tontine_member_history" as any).insert({
      tontine_id: selected.id,
      member_id: member.id,
      action: historyAction,
      performed_by: user?.id,
    } as any);
    if (openCycle) {
      await supabase.rpc("recalculate_cycle_expected" as any, {
        p_cycle_id: openCycle.id,
        p_contribution: selected.contribution_amount,
      } as any);
    }
    await loadDetail(selected.id);
    return true;
  };

  const cancelMemberPayment = async (member: TontineMember) => {
    if (!openCycle || !selected || !user) return;
    try {
      const { error: delError } = await supabase
        .from("tontine_payments")
        .delete()
        .eq("cycle_id", openCycle.id)
        .eq("member_id", member.id);
      if (delError) throw delError;

      await supabase.rpc("recalculate_cycle_collected" as any, {
        p_cycle_id: openCycle.id,
      } as any);

      await supabase.from("tontine_member_history" as any).insert({
        tontine_id: selected.id,
        member_id: member.id,
        action: "payment_cancelled",
        performed_by: user.id,
        note: `Cycle ${openCycle.cycle_number}`,
      } as any);

      toast({
        title: "Cotisation annulée",
        description: `Paiement de ${member.name} retiré du cycle ${openCycle.cycle_number}`,
      });
      setMemberActionOpen(false);
      await loadDetail(selected.id);
    } catch (e: any) {
      toast({ title: "Erreur annulation", description: e?.message, variant: "destructive" });
    }
  };


  // Beneficiary = member at index (cycle_number - 1) % members.length
  // Pas de bénéficiaire pour les caisses d'association (cotisations accumulées).
  const getBeneficiary = () => {
    if (!openCycle || members.length === 0) return null;
    if (selected?.caisse_type === "association") return null;
    const idx = (openCycle.cycle_number - 1) % members.length;
    return members[idx];
  };
  const beneficiary = getBeneficiary();
  const isAssociation = selected?.caisse_type === "association";

  // Total cumulé en caisse (tous cycles confondus) — pour les caisses d'association
  const totalEnCaisse = useMemo(() => {
    const closedSum = closedCycles.reduce((s, c) => s + Number(c.total_collected || 0), 0);
    return closedSum + Number(openCycle?.total_collected || 0);
  }, [closedCycles, openCycle]);

  const openPayModal = (member: TontineMember) => {
    setPayMember(member);
    setPayAmount(String(selected?.contribution_amount || 0));
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayNote("");
    setPayModalOpen(true);
  };

  const confirmPayment = async () => {
    if (!payMember || !openCycle || saving) return;
    if (!canManage) {
      toast({ title: "Action réservée aux gestionnaires", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("tontine_payments").insert({
        cycle_id: openCycle.id,
        member_id: payMember.id,
        amount_paid: Number(payAmount),
        payment_date: payDate,
        note: payNote || null,
      } as any);
      if (error) throw error;

      const { error: recalcError } = await supabase.rpc(
        "recalculate_cycle_collected" as any,
        { p_cycle_id: openCycle.id } as any
      );
      if (recalcError) {
        toast({ title: "Erreur de recalcul", description: recalcError.message, variant: "destructive" });
        return;
      }

      try {
        await logNotification({
          tontineId: selected!.id,
          membreId: payMember.id,
          type: "systeme",
          canal: "systeme",
          message: `${payMember.name} a cotisé ${fmt(Number(payAmount))} FCFA dans "${selected!.name}"`,
        });
      } catch {}

      toast({ title: `Paiement de ${payMember.name} enregistré` });
      setPayModalOpen(false);

      // Reload detail to check if all paid
      await loadDetail(selectedId!);

      // Check if all paid after reload
      const updatedPayments = (await supabase.from("tontine_payments").select("*").eq("cycle_id", openCycle.id)).data as unknown as TontinePayment[] || [];
      const updatedStatuses = members.map(m => {
        const mP = updatedPayments.filter(p => p.member_id === m.id);
        const total = mP.reduce((s, p) => s + Number(p.amount_paid), 0);
        return total >= (selected?.contribution_amount || 0);
      });
      if (updatedStatuses.length > 0 && updatedStatuses.every(Boolean)) {
        if (selected?.caisse_type === "association") {
          toast({ title: "Cycle complet", description: "Tous les membres ont cotisé ce cycle." });
        } else {
          const ben = getBeneficiary();
          toast({
            title: "Tour complet",
            description: `${ben?.name || "Le bénéficiaire"} reçoit ${fmt(openCycle.total_expected)}`,
          });
        }
      }
    } catch {
      toast({ title: "Erreur paiement", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    if (!newMemberName.trim() || !selected || addingMember) return;
    if (!canManage) {
      toast({ title: "Action réservée aux gestionnaires", variant: "destructive" });
      return;
    }
    setAddingMember(true);
    try {
      const phoneTrimmed = newMemberPhone.trim() || null;
      const { data: inserted, error } = await supabase.from("tontine_members" as any).insert({
        tontine_id: selected.id,
        name: newMemberName.trim(),
        phone: phoneTrimmed,
        is_owner: false,
      } as any).select().single();
      if (error) throw error;

      if (openCycle) {
        await supabase
          .from("tontine_cycles" as any)
          .update({ total_expected: (members.length + 1) * selected.contribution_amount } as any)
          .eq("id", openCycle.id);
      }

      if (inserted && phoneTrimmed) {
        await sendWhatsAppTontine(
          selected.name,
          inserted as unknown as TontineMember,
          "bienvenue",
          { montant: selected.contribution_amount, tontineId: selected.id }
        );
      }

      toast({ title: `${newMemberName.trim()} ajouté` });
      setNewMemberName("");
      setNewMemberPhone("");
      setAddMemberOpen(false);
      await loadDetail(selected.id);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erreur ajout membre", description: e?.message, variant: "destructive" });
    } finally {
      setAddingMember(false);
    }
  };

  const startFirstCycle = async () => {
    if (!selected || members.length === 0 || !canManage) return;
    try {
      const cycleInfo = generateCycleInfo(selected, 1, members.length);
      const { data: cycle, error } = await supabase
        .from("tontine_cycles" as any)
        .insert({ tontine_id: selected.id, ...cycleInfo } as any)
        .select().single();
      if (error) throw error;

      const cyc: any = cycle;
      for (const m of members) {
        if (m.phone) {
          await sendWhatsAppTontine(selected.name, m, "nouveau_cycle", {
            montant: selected.contribution_amount,
            cycleNumero: cyc?.cycle_number || 1,
            dateProchaineEcheance: cyc?.end_date,
            tontineId: selected.id,
          });
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      await logNotification({
        tontineId: selected.id,
        type: "systeme",
        message: `Cycle 1 ouvert pour la tontine "${selected.name}".`,
        canal: "systeme",
      });
      toast({ title: "Premier cycle ouvert" });
      await loadDetail(selected.id);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erreur ouverture cycle", description: e?.message, variant: "destructive" });
    }
  };

  const closeCycle = async () => {
    if (!openCycle || !selected || !canManage) return;
    try {
      const { error: closeCycleError } = await supabase
        .from("tontine_cycles")
        .update({ status: "closed" } as any)
        .eq("id", openCycle.id);
      if (closeCycleError) {
        toast({ title: "Erreur clôture cycle", description: closeCycleError.message, variant: "destructive" });
        return;
      }
      const nextInfo = generateCycleInfo(selected, openCycle.cycle_number + 1, members.length, openCycle.end_date);
      const { data: newCycle, error: newCycleError } = await supabase
        .from("tontine_cycles")
        .insert({ tontine_id: selected.id, ...nextInfo } as any)
        .select().single();
      if (newCycleError) {
        toast({ title: "Erreur création nouveau cycle", description: newCycleError.message, variant: "destructive" });
        return;
      }

      const nc: any = newCycle;
      for (const m of members) {
        if (m.phone) {
          await sendWhatsAppTontine(selected.name, m, "nouveau_cycle", {
            montant: selected.contribution_amount,
            cycleNumero: nc?.cycle_number || openCycle.cycle_number + 1,
            dateProchaineEcheance: nc?.end_date,
            tontineId: selected.id,
          });
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      toast({ title: "Cycle clôturé, nouveau cycle ouvert" });
      loadDetail(selected.id);
    } catch (e: any) {
      toast({ title: "Erreur clôture", description: e?.message, variant: "destructive" });
    }
  };

  const pauseTontine = async () => {
    if (!selected || !isOwner) return;
    const { error } = await supabase.from("tontines").update({ status: "paused" } as any).eq("id", selected.id);
    if (error) { toast({ title: "Erreur pause", variant: "destructive" }); return; }
    await logNotification({
      tontineId: selected.id, type: "systeme",
      message: `Tontine "${selected.name}" mise en pause.`, canal: "systeme",
    });
    toast({ title: "⏸️ Tontine mise en pause", description: "Les cotisations sont suspendues." });
    loadTontines();
  };

  const resumeTontine = async () => {
    if (!selected || !isOwner) return;
    const { error } = await supabase.from("tontines").update({ status: "active" } as any).eq("id", selected.id);
    if (error) { toast({ title: "Erreur reprise", variant: "destructive" }); return; }
    await logNotification({
      tontineId: selected.id, type: "systeme",
      message: `Tontine "${selected.name}" reprise.`, canal: "systeme",
    });
    toast({ title: "Tontine reprise" });
    loadTontines();
  };

  const closeTontine = async () => {
    if (!selected || !isOwner) return;
    const { error: closeError } = await supabase
      .from("tontines")
      .update({ status: "closed" } as any)
      .eq("id", selected.id);
    if (closeError) {
      toast({ title: "Clôture impossible", description: closeError.message, variant: "destructive" });
      return;
    }
    for (const m of members) {
      if (m.phone) {
        await sendWhatsAppTontine(selected.name, m, "cloture", { tontineId: selected.id });
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    await logNotification({
      tontineId: selected.id, type: "cloture",
      message: `Tontine "${selected.name}" clôturée.`, canal: "systeme",
    });
    const notifiedCount = members.filter((m) => m.phone).length;
    toast({
      title: "Tontine clôturée",
      description: notifiedCount > 0 ? `${notifiedCount} membre(s) notifié(s) sur WhatsApp` : undefined,
    });
    loadTontines();
  };

  const remindAllUnpaid = async () => {
    if (!selected || !openCycle || !canManage) return;
    const paidIds = new Set(
      members.filter(m => {
        const total = payments.filter(p => p.member_id === m.id).reduce((s, p) => s + Number(p.amount_paid), 0);
        return total >= selected.contribution_amount;
      }).map(m => m.id)
    );
    const count = await notifyAllUnpaid(
      members, paidIds, selected.name,
      openCycle.cycle_number, selected.contribution_amount, selected.id, openCycle.end_date
    );
    toast({
      title: count > 0 ? `${count} rappel(s) envoyé(s)` : "Tous les membres ont déjà payé",
      description: count > 0 ? "WhatsApp ouvert pour chaque membre" : undefined,
    });
  };

  const deleteTontine = async (id: string) => {
    const { error } = await supabase.from("tontines").delete().eq("id", id);
    if (error) {
      console.error("Delete tontine error:", error);
      toast({
        title: "Suppression impossible",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Tontine supprimée" });
    if (selectedId === id) setSelectedId(null);
    await loadTontines();
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  const AVATAR_COLORS = [
    "bg-primary/20 text-primary",
    "bg-destructive/20 text-destructive",
    "bg-amber-500/20 text-amber-500",
    "bg-blue-500/20 text-blue-400",
    "bg-emerald-500/20 text-emerald-400",
    "bg-purple-500/20 text-purple-400",
  ];


  const isCaisseClosed = (t: TontineData) => t.is_closed === true || t.status === "closed";

  // Liste unifiée : toutes les caisses (recurring + project + association), triées par activité récente.
  const allCaisses = useMemo(
    () => [...tontines].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [tontines]
  );

  const isTontine = (t: TontineData) =>
    t.caisse_type !== "project" && t.caisse_type !== "association";

  /** Caisses ou tontines, avant application du filtre de statut. */
  const familyCaisses = useMemo(
    () =>
      allCaisses.filter((t) =>
        familyFilter === "tontines" ? isTontine(t) : !isTontine(t)
      ),
    [allCaisses, familyFilter]
  );

  const visibleTontines = useMemo(() => {
    if (statusFilter === "active") return familyCaisses.filter(t => !isCaisseClosed(t));
    if (statusFilter === "closed") return familyCaisses.filter(t => isCaisseClosed(t));
    return familyCaisses;
  }, [familyCaisses, statusFilter]);

  const familyFilterBar = (
    <div className="flex gap-1.5 p-1.5 glass-card rounded-full mb-3">
      {([
        { key: "caisses" as const, label: "Caisses", Icon: Target },
        { key: "tontines" as const, label: "Tontines", Icon: Users },
      ]).map(({ key, label, Icon }) => {
        const on = familyFilter === key;
        const n = allCaisses.filter((t) =>
          key === "tontines" ? isTontine(t) : !isTontine(t)
        ).length;
        return (
          <button
            key={key}
            onClick={() => setFamilyFilter(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-[13.5px] font-extrabold transition-all ${
              on
                ? "gradient-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label} ({n})
          </button>
        );
      })}
    </div>
  );

  const statusFilterBar = (
    <div className="flex gap-1 p-1 glass-card rounded-xl mb-6">
      {(["active", "closed", "all"] as const).map((f) => {
        const counts = {
          active: familyCaisses.filter(t => !isCaisseClosed(t)).length,
          closed: familyCaisses.filter(t => isCaisseClosed(t)).length,
          all: familyCaisses.length,
        };
        const labels: Record<typeof f, string> = {
          active: "Actives",
          closed: "Clôturées",
          all: "Toutes",
        };
        const active = statusFilter === f;
        return (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${active ? "gradient-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {labels[f]} ({counts[f]})
          </button>
        );
      })}
    </div>
  );

  // Style + libellé par type de caisse (langage humain)
  const typeMeta = (t: TontineData) => {
    if (t.caisse_type === "project") return { Icon: Target, label: "Événement", cls: "bg-primary/12 text-primary" };
    if (t.caisse_type === "association") return { Icon: Building2, label: "Groupe", cls: "bg-primary/8 text-primary/75" };
    return { Icon: RefreshCw, label: "Tournante", cls: "bg-primary/15 text-primary" };
  };


  // ─── LIST VIEW ───
  if (!selectedId) {
    return (
      <DashboardLayout title="Mes tontines">
        {/* Halo ambiant. overflow-x-clip : le halo (520 px) dépassait l'écran
            et faisait glisser toute la page vers la gauche sur téléphone. */}
        <div className="relative overflow-x-clip">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[260px] opacity-60 motion-reduce:hidden"
            style={{
              background:
                "radial-gradient(closest-side, hsl(var(--primary) / 0.22), transparent 70%)",
              filter: "blur(6px)",
            }}
          />
          <p className="relative text-xs uppercase tracking-wider text-primary font-bold mb-2">
            Tes tontines & cotisations
          </p>
        </div>

        {familyFilterBar}
        {statusFilterBar}
        <Button onClick={() => setCreateOpen(true)} className="w-full mb-4 gradient-primary text-primary-foreground shadow-[0_0_24px_-8px_hsl(var(--primary))]">
          <Plus className="w-4 h-4 mr-2" /> Créer une tontine
        </Button>
        <CreateTontineModal open={createOpen} onOpenChange={setCreateOpen} onCreated={loadTontines} />

        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <ListItemSkeleton key={i} />)
          ) : visibleTontines.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-9 h-9 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold text-foreground mb-1">
                {statusFilter === "closed" ? "Aucune tontine clôturée" : "Aucune tontine pour l'instant"}
              </p>
              <p className="text-sm text-muted-foreground">
                {statusFilter === "closed"
                  ? "Les tontines actives apparaissent sous l'onglet Actives."
                  : "Crée ta première tontine pour commencer"}
              </p>
            </div>
          ) : (
            visibleTontines.map((t, i) => {
              const cycle = cycleMap[t.id];
              const mc = memberCounts[t.id] || 0;
              const myRole = roleMap[t.id] || (t.user_id === user?.id ? "owner" : "viewer");
              const canDelete = myRole === "owner";
              const meta = typeMeta(t);

              // Infos adaptées selon le type + montant clé
              let subline = "";
              let progressPct = 0;
              let keyAmount: React.ReactNode = null;

              if (t.caisse_type === "project") {
                const target = Number(t.target_amount || 0);
                const collected = Number(cycle?.total_collected || 0);
                progressPct = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;
                subline = `${mc} participant${mc > 1 ? "s" : ""}`;
                keyAmount = (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-foreground font-bold text-base">{fmt(collected)}</span>
                    <span className="text-xs text-muted-foreground">/ {fmt(target)}</span>
                  </div>
                );
              } else if (t.caisse_type === "association") {
                const collected = Number(cycle?.total_collected || 0);
                subline = `${mc} membre${mc > 1 ? "s" : ""}`;
                progressPct = 100;
                keyAmount = (
                  <span className="text-foreground font-bold text-base">{fmt(collected)}</span>
                );
              } else {
                const paidInCycle = cycle ? Math.round(cycle.total_collected / (t.contribution_amount || 1)) : 0;
                progressPct = mc > 0 ? Math.min(100, Math.round((paidInCycle / mc) * 100)) : 0;
                subline = `${fmt(t.contribution_amount)} par tour · ${mc} membre${mc > 1 ? "s" : ""}`;
                keyAmount = (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-foreground font-bold text-base">{paidInCycle}</span>
                    <span className="text-xs text-muted-foreground">/ {mc} ont cotisé</span>
                  </div>
                );
              }

              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.3 }}
                  onClick={() => openDetail(t.id)}
                  className="relative glass-card rounded-2xl p-4 mb-3 cursor-pointer active:scale-[0.98] border border-border/50 hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-br from-white/[0.04] to-transparent overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-bold text-foreground truncate"><UserText>{t.name}</UserText></p>
                        {myRole !== "owner" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400 flex-shrink-0">
                            {myRole === "manager" ? "Co-gestion" : "Observateur"}
                          </span>
                        )}
                        {t.is_closed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive flex-shrink-0">Clôturé</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
                        <span className="font-semibold text-foreground/80">{meta.label}</span>
                        <span className="opacity-40">·</span>
                        <span className="truncate">{subline}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center border border-primary/15 ${meta.cls}`}>
                        <meta.Icon className="w-5 h-5" />
                      </div>
                      {canDelete && (
                        <ConfirmDeleteDialog onConfirm={() => deleteTontine(t.id)} title="Supprimer cette tontine ?">
                          <button className="text-muted-foreground hover:text-destructive p-1" onClick={e => e.stopPropagation()} aria-label="Supprimer"><X className="w-4 h-4" /></button>
                        </ConfirmDeleteDialog>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  {/* Montant clé mis en avant, puis barre + pourcentage */}
                  <div className="mt-1">
                    <div className="flex items-end justify-between mb-2">
                      <div className="min-w-0">{keyAmount}</div>
                      <span className="text-sm font-extrabold text-primary tabular-nums flex-shrink-0">
                        {progressPct}%
                      </span>
                    </div>
                    <div className="w-full bg-secondary/60 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 1.2, ease: "easeOut", delay: 0.05 * i }}
                        className="h-2 rounded-full bg-gradient-to-r from-primary/70 to-primary shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </DashboardLayout>
    );
  }


  // ─── DETAIL VIEW ───
  // Si c'est une caisse de projet → vue dédiée (recettes/dépenses/solde)
  if (selected?.caisse_type === "project") {
    return (
      <DashboardLayout title={selected.name}>
        <ProjectCaisseView tontine={selected} onBack={goBack} onUpdated={loadTontines} currentRole={currentRole} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={selected?.name || "Tontine"}>
      <button onClick={goBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Retour
      </button>

      {/* ─── STATUS BADGE + ACTIONS ─── */}
      <div className="flex items-center justify-between mb-3">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
          isClosed ? "bg-destructive/15 text-destructive" :
          isPaused ? "bg-amber-500/15 text-amber-500" :
          "bg-emerald-500/15 text-emerald-400"
        }`}>
          {isClosed ? <Lock className="w-3 h-3" /> :
           isPaused ? <PauseCircle className="w-3 h-3" /> :
           <CheckCircle className="w-3 h-3" />}
          {isClosed ? "Terminée" : isPaused ? "En pause" : "Active"}
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl glass-card hover:bg-primary/10 transition-colors text-xs font-bold text-primary"
              title="Inviter"
            >
              <Link2 className="w-4 h-4" /> Inviter
            </button>
          )}
          {isOwner && !isClosed && (
            <button
              onClick={() => setEditCaisseOpen(true)}
              className="p-2 rounded-xl glass-card hover:bg-primary/10 transition-colors"
              title="Modifier la tontine"
            >
              <Pencil className="w-4 h-4 text-primary" />
            </button>
          )}
          {!canManage && (
            <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <ShieldAlert className="w-3 h-3" /> Lecture seule
            </div>
          )}
        </div>
      </div>

      {/* Owner-only status controls */}
      {isOwner && !isClosed && (
        <div className="flex gap-2 mb-3">
          {isPaused ? (
            <button onClick={resumeTontine}
              className="flex-1 glass-card rounded-xl p-2.5 text-xs font-bold text-foreground border border-emerald-500/20 flex items-center justify-center gap-1.5">
              <PlayCircle className="w-4 h-4" /> Reprendre
            </button>
          ) : (
            <button onClick={pauseTontine}
              className="flex-1 glass-card rounded-xl p-2.5 text-xs font-bold text-foreground border border-amber-500/20 flex items-center justify-center gap-1.5">
              <PauseCircle className="w-4 h-4" /> Mettre en pause
            </button>
          )}
          <button onClick={() => setShowCloture(true)}
            className="flex-1 glass-card rounded-xl p-2.5 text-xs font-bold text-destructive border border-destructive/20 flex items-center justify-center gap-1.5">
            <XCircle className="w-4 h-4" /> Clôturer
          </button>
        </div>
      )}

      {/* Quitter la tontine (tous les collaborateurs) */}
      {selected && (
        <div className="mb-3">
          <LeaveCaisseButton
            caisseId={selected.id}
            isOwner={isOwner}
            onLeft={goBack}
            className="w-full"
          />
        </div>
      )}

      {/* Suivi par (collaborateurs) */}
      {selected && (
        <CaisseCollaborators caisseId={selected.id} canManage={canManage} />
      )}

      {/* Paused banner */}
      {isPaused && (
        <div className="glass-card rounded-xl p-3 mb-3 border border-amber-500/30 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200">
            Tontine en pause — les cotisations sont temporairement suspendues.
          </p>
        </div>
      )}

      {/* Non-owner banner */}
      {!canManage && (
        <div className="glass-card rounded-xl p-3 mb-3 border border-border flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Vous êtes en lecture seule. Seuls le créateur et les co-gestionnaires peuvent effectuer des actions.
          </p>
        </div>
      )}

      {/* ─── CURRENT CYCLE SUMMARY ─── */}
      {openCycle ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-foreground">Cycle {openCycle.cycle_number} — {openCycle.period_label}</p>
            <span className="text-xs font-bold text-primary">{cyclePct}%</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Du {new Date(openCycle.start_date).toLocaleDateString("fr-FR")} au {new Date(openCycle.end_date).toLocaleDateString("fr-FR")}
          </p>
          <Progress value={cyclePct} className="h-2.5 mb-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{paidCount}/{members.length} ont cotisé</span>
            <span>{fmt(openCycle.total_collected)} / {fmt(openCycle.total_expected)}</span>
          </div>

          {/* Beneficiary (tontine récurrente uniquement) */}
          {beneficiary && (
            <div className="mt-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Bénéficiaire de ce tour</p>
                  <p className="text-sm font-bold text-foreground truncate">{beneficiary.name}</p>
                </div>
                <span className="text-sm font-bold text-primary shrink-0">{fmt(openCycle.total_expected)}</span>
              </div>
            </div>
          )}

          {/* Total cumulé en caisse (association — pas de bénéficiaire) */}
          {isAssociation && (
            <div className="mt-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Total en caisse (cumulé)</p>
                  <p className="text-sm font-bold text-foreground tabular-nums">{fmt(totalEnCaisse)}</p>
                </div>
              </div>
            </div>
          )}

          {/* All paid celebration */}
          {allPaid && !isAssociation && (
            <div className="mt-3 p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
              <p className="text-sm font-bold text-primary">Tour complet</p>
              <p className="text-xs text-muted-foreground">
                {beneficiary?.name} reçoit {fmt(openCycle.total_expected)}
              </p>
            </div>
          )}
          {allPaid && isAssociation && (
            <div className="mt-3 p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
              <p className="text-sm font-bold text-primary">Cycle complet</p>
              <p className="text-xs text-muted-foreground">Tous les membres ont cotisé ce cycle.</p>
            </div>
          )}
        </motion.div>
      ) : (
        <div className="glass-card rounded-2xl p-4 mb-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">Aucun cycle ouvert</p>
          {members.length > 0 ? (
            <Button onClick={startFirstCycle} className="gradient-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-1" /> Ouvrir le 1er cycle
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Ajoute d'abord des membres ci-dessous</p>
          )}
        </div>
      )}

      {/* ─── DETAIL TABS ─── */}
      <div className="flex gap-1 p-1 glass-card rounded-xl mb-4">
        {[
          { key: "membres" as const, label: "Membres", icon: <Users className="w-3.5 h-3.5" /> },
          { key: "calendrier" as const, label: "Calendrier", icon: <Calendar className="w-3.5 h-3.5" /> },
          { key: "notifs" as const, label: "Notifs", icon: <Bell className="w-3.5 h-3.5" /> },
        ].map(t => (
          <button key={t.key} onClick={() => setDetailTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              detailTab === t.key ? "gradient-primary text-primary-foreground" : "text-muted-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: MEMBRES ─── */}
      {detailTab === "membres" && (<>
        {canManage && openCycle && isActive && statuses.some(s => s.status !== "paid") && (
          <button onClick={remindAllUnpaid}
            className="w-full glass-card rounded-xl p-3 flex items-center justify-center gap-2 border border-primary/30 mb-3 hover:bg-primary/5 transition-colors">
            <MessageCircle className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground">
              Rappeler tous les non-payés ({statuses.filter(s => s.status !== "paid").length})
            </span>
          </button>
        )}

        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">Membres ({visibleMembers.length})</p>
          <Button size="sm" variant="outline" className="glass" disabled={!canManage || isClosed}
            onClick={() => setAddMemberOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Membre
          </Button>
        </div>
        {inactiveCount > 0 && (
          <button
            onClick={() => setShowRemovedMembers(!showRemovedMembers)}
            className="text-xs text-muted-foreground underline mb-3 block">
            {showRemovedMembers ? "Masquer les membres inactifs" : `Voir les membres inactifs (${inactiveCount})`}
          </button>
        )}
        <div className="space-y-2 mb-4">
          {statuses.length > 0 ? statuses.map((s, i) => (
            <motion.div key={s.member.id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * i }}>
              <div className="glass-card rounded-xl p-4 flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                  <p className="text-sm font-bold text-primary-foreground">{s.member.name.charAt(0).toUpperCase()}</p>
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5 flex-wrap">
                    <span className="truncate">{s.member.name}</span>
                    {s.member.is_owner && <span className="text-xs text-primary">(Moi)</span>}
                    {s.member.status === "suspended" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500/40 text-yellow-500">Suspendu</Badge>
                    )}
                    {s.member.status === "removed" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/40 text-destructive">Retiré</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.member.status === "removed"
                      ? "Ne participe plus"
                      : s.member.status === "suspended"
                        ? "Suspendu temporairement"
                        : s.status === "paid" ? "A payé ce cycle" : s.status === "partial" ? `${fmt(s.totalPaid)} / ${fmt(s.expected)}` : "En attente de paiement"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {s.member.phone && s.status !== "paid" && canManage && isActive && openCycle && s.member.status !== "removed" && s.member.status !== "suspended" && (
                    <button
                      onClick={() => sendWhatsAppTontine(selected!.name, s.member, "rappel_cotisation", {
                        montant: selected!.contribution_amount,
                        cycleNumero: openCycle.cycle_number,
                        dateProchaineEcheance: openCycle.end_date,
                        tontineId: selected!.id,
                      })}
                      className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                      title="Rappeler sur WhatsApp">
                      <MessageCircle className="w-4 h-4 text-primary" />
                    </button>
                  )}
                  {s.member.status !== "removed" && s.member.status !== "suspended" && (
                    s.status === "paid" ? (
                      <CheckCircle className="w-5 h-5 text-primary" />
                    ) : (
                      <button
                        onClick={() => openPayModal(s.member)}
                        disabled={!canManage || !isActive}
                        className="gradient-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                        + Payer
                      </button>
                    )
                  )}
                  {canManage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMember(s.member);
                        setMemberActionOpen(true);
                        loadMemberHistory(s.member.id);
                      }}
                      className="p-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors"
                      title="Actions">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )) : visibleMembers.length > 0 ? visibleMembers.map((m) => (
            <div key={m.id} className="glass-card rounded-xl p-4 flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                <p className="text-sm font-bold text-primary-foreground">{m.name.charAt(0).toUpperCase()}</p>
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5 flex-wrap">
                  <span className="truncate">{m.name}</span>
                  {m.is_owner && <span className="text-xs text-primary">(Moi)</span>}
                  {m.status === "suspended" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500/40 text-yellow-500">Suspendu</Badge>
                  )}
                  {m.status === "removed" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/40 text-destructive">Retiré</Badge>
                  )}
                </p>
              </div>
              {canManage && (
                <button
                  onClick={() => { setActionMember(m); setMemberActionOpen(true); loadMemberHistory(m.id); }}
                  className="p-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors">
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          )) : (
            <p className="text-xs text-muted-foreground text-center py-4">Aucun membre</p>
          )}
        </div>

        {openCycle && canManage && isActive && (
          <Button onClick={closeCycle} variant="glass" className="w-full mb-4">
            <Lock className="w-4 h-4 mr-2" /> Clôturer ce cycle
          </Button>
        )}
      </>)}

      {/* ─── TAB: CALENDRIER ─── */}
      {detailTab === "calendrier" && selected && (
        <CalendrierTab tontine={selected} openCycle={openCycle} members={members} />
      )}

      {/* ─── TAB: NOTIFICATIONS ─── */}
      {detailTab === "notifs" && selected && (
        <NotificationHistory tontineId={selected.id} />
      )}

      {/* ─── HISTORY ─── */}
      {closedCycles.length > 0 && (
        <>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            Cycles passés ({closedCycles.length})
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-2 mb-4"
              >
                {closedCycles.map(c => {
                  const cPct = c.total_expected > 0 ? Math.round((c.total_collected / c.total_expected) * 100) : 0;
                  const benIdx = (c.cycle_number - 1) % members.length;
                  const ben = members[benIdx];
                  return (
                    <div key={c.id} className="glass-card rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground truncate">Cycle {c.cycle_number} — {c.period_label}</span>
                        <span className="text-xs font-bold text-primary shrink-0">{cPct}%</span>
                      </div>
                      <Progress value={cPct} className="h-1.5 mb-1" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{fmt(c.total_collected)} / {fmt(c.total_expected)}</span>
                        {ben && <span className="truncate ml-2">{ben.name}</span>}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ─── HISTORIQUE (cycles + paiements + filtres + PDF) ─── */}
      {selected && <TontineHistory tontine={selected} />}

      {/* ─── MONTHLY SUMMARY & REPORTS ─── */}
      {(closedCycles.length > 0 || openCycle) && (
        <div className="mb-4">
          {/* Monthly summary card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-4 mb-3"
          >
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm font-bold text-foreground">Récapitulatif</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-secondary rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground font-medium">Cycles</p>
                <p className="text-sm font-bold text-foreground">{closedCycles.length + (openCycle ? 1 : 0)}</p>
              </div>
              <div className="bg-secondary rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground font-medium">Total collecté</p>
                <p className="text-sm font-bold text-primary tabular-nums">
                  {fmt(closedCycles.reduce((s, c) => s + c.total_collected, 0) + (openCycle?.total_collected || 0))}
                </p>
              </div>
              <div className="bg-secondary rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground font-medium">Membres</p>
                <p className="text-sm font-bold text-foreground">{members.length}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 glass"
                onClick={() => setShowReports(!showReports)}
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                {showReports ? "Masquer rapport" : "Voir rapport & PDF"}
              </Button>
            </div>
          </motion.div>

          {/* Reports detail */}
          <AnimatePresence>
            {showReports && selected && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <ReportsTab tontines={[selected]} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ─── ADD MEMBER MODAL ─── */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent aria-describedby={undefined} className="glass-card border-border">
          <DialogHeader>
            <DialogTitle>Ajouter un membre</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nom *</label>
              <Input
                autoFocus
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addMember(); }}
                placeholder="Ex: Aïssatou Diallo"
                className="bg-secondary border-border"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Téléphone (optionnel)</label>
              <Input
                value={newMemberPhone}
                onChange={(e) => setNewMemberPhone(e.target.value)}
                placeholder="+225 ..."
                className="bg-secondary border-border"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAddMemberOpen(false)} className="flex-1 glass">
                Annuler
              </Button>
              <Button
                onClick={addMember}
                disabled={addingMember || !newMemberName.trim()}
                className="flex-1 gradient-primary text-primary-foreground"
              >
                {addingMember ? "Ajout..." : "Ajouter"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MEMBER ACTIONS SHEET ─── */}
      <Sheet open={memberActionOpen} onOpenChange={setMemberActionOpen}>
        <SheetContent aria-describedby={undefined} side="bottom" className="glass-card border-border !inset-auto !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-[calc(100vw-2rem)] !max-w-md !rounded-3xl !border max-h-[85vh] overflow-y-auto data-[state=closed]:!slide-out-to-bottom-0 data-[state=open]:!slide-in-from-bottom-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {actionMember && (
            <>
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                  <p className="text-lg font-bold text-primary-foreground">
                    {actionMember.name.charAt(0).toUpperCase()}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-foreground truncate">{actionMember.name}</p>
                  {actionMember.phone && (
                    <p className="text-xs text-muted-foreground truncate">{actionMember.phone}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {/* Annuler la cotisation de ce cycle */}
                {statuses.find(s => s.member.id === actionMember.id)?.status === "paid" && canManage && openCycle && (
                  <button
                    onClick={() => cancelMemberPayment(actionMember)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl glass-card border border-yellow-500/20 text-left">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
                      <XCircle className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Annuler sa cotisation</p>
                      <p className="text-xs text-muted-foreground">Marquer comme non payé pour ce cycle</p>
                    </div>
                  </button>
                )}

                {/* Rappel WhatsApp */}
                {actionMember.phone && canManage && isActive && openCycle && actionMember.status !== "removed" && (
                  <button
                    onClick={async () => {
                      await sendWhatsAppTontine(selected!.name, actionMember, "rappel_cotisation", {
                        montant: selected!.contribution_amount,
                        cycleNumero: openCycle.cycle_number,
                        dateProchaineEcheance: openCycle.end_date,
                        tontineId: selected!.id,
                      });
                      setMemberActionOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-4 rounded-xl glass-card border border-primary/20 text-left">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Rappeler sur WhatsApp</p>
                      <p className="text-xs text-muted-foreground">Envoyer un rappel de cotisation</p>
                    </div>
                  </button>
                )}

                {/* Suspendre temporairement */}
                {(actionMember.status === "active" || !actionMember.status) && canManage && (
                  <button
                    onClick={async () => {
                      const ok = await performMemberAction("suspended", actionMember, "suspended");
                      if (ok) {
                        toast({ title: `${actionMember.name} suspendu temporairement` });
                        setMemberActionOpen(false);
                      }
                    }}
                    className="w-full flex items-center gap-3 p-4 rounded-xl glass-card border border-yellow-500/20 text-left">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
                      <PauseCircle className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Suspendre temporairement</p>
                      <p className="text-xs text-muted-foreground">Ne compte plus dans le cycle actuel</p>
                    </div>
                  </button>
                )}

                {/* Réactiver */}
                {actionMember.status === "suspended" && canManage && (
                  <button
                    onClick={async () => {
                      const ok = await performMemberAction("active", actionMember, "reactivated");
                      if (ok) {
                        toast({ title: `${actionMember.name} réactivé` });
                        setMemberActionOpen(false);
                      }
                    }}
                    className="w-full flex items-center gap-3 p-4 rounded-xl glass-card border border-primary/20 text-left">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <PlayCircle className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Réactiver le membre</p>
                      <p className="text-xs text-muted-foreground">Reprend les cotisations normalement</p>
                    </div>
                  </button>
                )}

                {/* Réintégrer si retiré */}
                {actionMember.status === "removed" && canManage && (
                  <button
                    onClick={async () => {
                      const ok = await performMemberAction("active", actionMember, "reinstated");
                      if (ok) {
                        toast({ title: `${actionMember.name} réintégré` });
                        setMemberActionOpen(false);
                      }
                    }}
                    className="w-full flex items-center gap-3 p-4 rounded-xl glass-card border border-primary/20 text-left">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <RotateCcw className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Réintégrer le membre</p>
                      <p className="text-xs text-muted-foreground">Le remettre dans la tontine</p>
                    </div>
                  </button>
                )}

                {/* Retirer définitivement (avec confirmation) */}
                {actionMember.status !== "removed" && canManage && (
                  <button
                    onClick={() => setShowRemoveConfirm(true)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl glass-card border border-destructive/20 text-left">
                    <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
                      <UserX className="w-5 h-5 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Retirer de la tontine</p>
                      <p className="text-xs text-muted-foreground">Ne peut plus cotiser ni bénéficier</p>
                    </div>
                  </button>
                )}
              </div>

              {/* Historique des actions */}
              {historyLoading ? (
                <p className="mt-6 text-xs text-muted-foreground text-center">Chargement de l'historique...</p>
              ) : memberHistory.length > 0 ? (
                <div className="mt-6 pt-4 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Historique</p>
                  <div className="space-y-2">
                    {memberHistory.map((h) => {
                      const icons: Record<string, LucideIcon> = {
                        suspended: PauseCircle, reactivated: PlayCircle, removed: Ban,
                        reinstated: CheckCircle2, paid: Wallet, payment_cancelled: Undo2,
                      };
                      const HistoryIcon = icons[h.action] || FileText;
                      const labels: Record<string, string> = {
                        suspended: "Suspendu", reactivated: "Réactivé",
                        removed: "Retiré", reinstated: "Réintégré",
                        paid: "Cotisation enregistrée", payment_cancelled: "Cotisation annulée",
                      };
                      return (
                        <div key={h.id} className="flex items-start gap-2 text-xs">
                          <HistoryIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground font-medium">{labels[h.action] || h.action}</p>
                            <p className="text-muted-foreground">
                              {new Date(h.created_at).toLocaleDateString("fr-FR", {
                                day: "2-digit", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                              {h.note && ` · ${h.note}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── CONFIRMATION RETRAIT ─── */}
      <Dialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <DialogContent aria-describedby={undefined} className="glass-card border-border">
          <DialogHeader>
            <DialogTitle>Retirer {actionMember?.name} ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ce membre ne pourra plus cotiser ni bénéficier du pot. Son historique de paiements est conservé.
            Cette action peut être annulée en le réintégrant.
          </p>
          {(() => {
            const ms = statuses.find(s => s.member.id === actionMember?.id);
            if (!ms?.totalPaid) return null;
            return (
              <div className="rounded-lg p-3 bg-secondary/50 border border-border">
                <p className="text-xs text-muted-foreground">
                  Total cotisé par ce membre :{" "}
                  <span className="text-foreground font-semibold">{fmt(ms.totalPaid)}</span>
                </p>
              </div>
            );
          })()}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowRemoveConfirm(false)} className="flex-1 glass">
              Annuler
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={async () => {
                if (!actionMember) return;
                const ok = await performMemberAction("removed", actionMember, "removed");
                setShowRemoveConfirm(false);
                if (ok) {
                  toast({ title: `${actionMember.name} retiré de la tontine` });
                  setMemberActionOpen(false);
                }
              }}>
              Retirer définitivement
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      {/* ─── PAYMENT MODAL ─── */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent aria-describedby={undefined} className="glass-card border-border">
          <DialogHeader>
            <DialogTitle className="truncate">Paiement — {payMember?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Montant (FCFA)</label>
              <MoneyInput value={payAmount} onChange={(n) => setPayAmount(n ? String(n) : "")} showCurrency={false} className="[&>input]:bg-secondary [&>input]:border-border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Date du paiement</label>
              <DatePickerField value={payDate} onChange={setPayDate} className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Note (optionnel)</label>
              <Input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Détail..." className="bg-secondary border-border" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPayModalOpen(false)} className="flex-1 glass">
                Annuler
              </Button>
              <Button onClick={confirmPayment} disabled={saving} className="flex-1 gradient-primary text-primary-foreground">
                Confirmer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── CONFIRM CLOTURE DIALOG ─── */}
      <Dialog open={showCloture} onOpenChange={setShowCloture}>
        <DialogContent aria-describedby={undefined} className="glass-card border-border">
          <DialogHeader>
            <DialogTitle>Clôturer cette tontine ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action est irréversible. La tontine sera fermée et tous les membres avec un numéro WhatsApp seront notifiés automatiquement.
          </p>
          {members.filter(m => m.phone).length > 0 && (
            <div className="glass-card rounded-xl p-3 border border-primary/20 mt-2">
              <p className="text-xs text-foreground">
                {members.filter(m => m.phone).length} membre(s) seront notifiés sur WhatsApp.
              </p>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1 glass" onClick={() => setShowCloture(false)}>
              Annuler
            </Button>
            <Button variant="destructive" className="flex-1" onClick={async () => {
              setShowCloture(false);
              await closeTontine();
            }}>
              Clôturer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Edit caisse (tontine) ─── */}
      {selected && (
        <EditCaisseModal
          open={editCaisseOpen}
          onClose={() => setEditCaisseOpen(false)}
          tontine={selected}
          onUpdated={() => { loadDetail(selected.id); loadTontines(); }}
        />
      )}

      {/* ─── Invite collaborators ─── */}
      {selected && (
        <InviteCaisseModal
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          caisseId={selected.id}
          caisseName={selected.name}
        />
      )}
    </DashboardLayout>
  );
};

// ─── CALENDRIER TAB ───
const CalendrierTab = ({
  tontine, openCycle, members,
}: {
  tontine: TontineData;
  openCycle: TontineCycle | null;
  members: TontineMember[];
}) => {
  const planning = useMemo(() => {
    if (members.length === 0) return [];
    const today = new Date();
    const startBase = openCycle ? new Date(openCycle.start_date) : new Date(tontine.start_date || today);
    const baseCycle = openCycle?.cycle_number || 1;
    const daysFor = (f: string) => {
      if (f === "weekly") return 7;
      if (f === "monthly") return 30;
      if (f === "quarterly") return 90;
      if (f === "annual") return 365;
      if (f === "custom" && tontine.custom_frequency_days) return tontine.custom_frequency_days;
      return 30;
    };
    const days = daysFor(tontine.frequency);
    const count = Math.min(members.length * 2, 12);
    const out: Array<{ cycle: number; member: TontineMember; date: Date; pot: number; isPast: boolean; isCurrent: boolean }> = [];
    for (let i = 0; i < count; i++) {
      const cycleNum = baseCycle + i;
      const d = new Date(startBase);
      d.setDate(startBase.getDate() + i * days);
      const member = members[(cycleNum - 1) % members.length];
      out.push({
        cycle: cycleNum, member, date: d,
        pot: members.length * tontine.contribution_amount,
        isPast: d < today && cycleNum !== baseCycle,
        isCurrent: cycleNum === baseCycle,
      });
    }
    return out;
  }, [tontine, openCycle, members]);

  if (members.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 text-center">
        <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Ajoute des membres pour voir le calendrier</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="glass-card rounded-xl p-3 mb-2">
        <p className="text-xs text-muted-foreground">
          Basé sur la fréquence{" "}
          <span className="text-foreground font-bold">{tontine.frequency}</span>
          {" "}· Pot par cycle :{" "}
          <span className="text-primary font-bold">
            {(members.length * tontine.contribution_amount).toLocaleString("fr-FR")}
          </span>
        </p>
      </div>
      {planning.map((item) => (
        <div key={item.cycle}
          className={`glass-card rounded-xl p-3 flex items-center gap-3 ${
            item.isCurrent ? "border border-primary/40" : item.isPast ? "opacity-60" : ""
          }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs ${
            item.isCurrent ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          }`}>
            C{item.cycle}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-foreground truncate">
                {item.member?.name || "À définir"}
              </p>
              {item.isCurrent && (
                <Badge className="bg-primary/20 text-primary text-[10px] py-0 h-4">En cours</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {item.date.toLocaleDateString("fr-FR", {
                weekday: "short", day: "2-digit", month: "long", year: "numeric",
              })}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-primary tabular-nums">
              {item.pot.toLocaleString("fr-FR")}
            </p>
            <p className="text-[10px] text-muted-foreground">pot total</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── NOTIFICATION HISTORY ───
const NotificationHistory = ({ tontineId }: { tontineId: string }) => {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("tontine_notifications" as any)
      .select("*, tontine_members(name)")
      .eq("tontine_id", tontineId)
      .order("envoye_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setNotifs((data as any[]) || []);
        setLoading(false);
      });
  }, [tontineId]);

  const typeIcon: Record<string, LucideIcon> = {
    rappel_cotisation: MessageCircle,
    nouveau_cycle: Bell,
    bienvenue: Hand,
    cloture: Lock,
    systeme: Settings,
  };

  if (loading) return <p className="text-xs text-muted-foreground text-center py-6">Chargement...</p>;
  if (!notifs.length) return (
    <div className="glass-card rounded-2xl p-6 text-center">
      <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">Aucune notification envoyée</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {notifs.map((n) => (
        <div key={n.id} className="glass-card rounded-xl p-3 flex gap-3">
          <span className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            {(() => { const NotifIcon = typeIcon[n.type] || Mail; return <NotifIcon className="w-4 h-4 text-primary" />; })()}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs font-bold text-foreground truncate">
                {n.tontine_members?.name || "Système"}
              </p>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">
                {new Date(n.envoye_at).toLocaleDateString("fr-FR", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-line">
              {n.message}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TontinePage;
