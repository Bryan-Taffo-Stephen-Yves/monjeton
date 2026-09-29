import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountKeypad } from "@/components/transaction/AmountKeypad";
import { AmountDisplay } from "@/components/transaction/AmountDisplay";
import { VoiceRecorderSheet } from "@/components/transaction/VoiceRecorderSheet";
import { useLiveTranscript } from "@/hooks/useLiveTranscript";
import {
  CategorySheet,
  WalletSheet,
  DateSheet,
  MetaChip,
} from "@/components/transaction/TransactionPickers";
import { getCatIcon } from "@/lib/getCatIcon";
import { CreditCard, CalendarDays, StickyNote } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import DashboardLayout from "@/components/DashboardLayout";
import { Screen } from "@/components/layout/Screen";
import VoiceConfirmationDialog, { type ParsedTransaction } from "@/components/voice/VoiceConfirmationDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateAmount, sanitizeNote, validatePayloadSize, MAX_AUDIO_SIZE_BYTES } from "@/lib/security";
import { checkAndCreateNotifications } from "@/lib/notificationService";
import { isStoreApp } from "@/lib/platform";
import { syncAutoBudget } from "@/lib/autoBudget";
import { checkBudgetWhatsappAlerts } from "@/lib/budgetWhatsappAlerts";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { UpgradeSheet } from "@/components/UpgradeSheet";
import {
  consumeFeature, fetchMonthlyUsage, isFreePlanLimitError, limitReachedMessage,
  quotaFromLimitError, type FeatureQuota, type FreeFeature,
} from "@/lib/freePlan";

const NewTransaction = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [amountCaret, setAmountCaret] = useState(0);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCatSheet, setShowCatSheet] = useState(false);
  const [showWalletSheet, setShowWalletSheet] = useState(false);
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [showNote, setShowNote] = useState(false);

  // Voice states
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);
  const cancelledRef = useRef(false);
  const live = useLiveTranscript();
  const [showRetryVoice, setShowRetryVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Conversational AI states
  const [voiceTransactions, setVoiceTransactions] = useState<ParsedTransaction[] | null>(null);
  const [isSubmittingVoice, setIsSubmittingVoice] = useState(false);
  const [usage, setUsage] = useState<Record<string, FeatureQuota> | null>(null);
  const [upgrade, setUpgrade] = useState<{ title: string; description: string; plan?: string } | null>(null);

  const refreshUsage = () => {
    if (!user) return;
    fetchMonthlyUsage(user.id).then(setUsage).catch(() => {});
  };
  useEffect(refreshUsage, [user]);

  const showLimit = (feature: FreeFeature, quota?: FeatureQuota) => {
    setUpgrade({ ...limitReachedMessage(feature, quota), plan: quota?.plan });
  };
  const isExhausted = (q?: FeatureQuota) =>
    !!q && !q.unlimited && q.limit != null && q.used >= q.limit;
  const manualQuota = usage?.manual_expense;
  const manualLeft =
    manualQuota && !manualQuota.unlimited && manualQuota.limit != null
      ? Math.max(0, manualQuota.limit - manualQuota.used)
      : null;

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("categories").select("*").eq("user_id", user.id),
      supabase.from("wallets").select("*").eq("user_id", user.id),
    ]).then(([catRes, walRes]) => {
      setCategories(catRes.data || []);
      const wals = walRes.data || [];
      setWallets(wals);
      if (wals.length === 1) setWalletId(wals[0].id);
    });
  }, [user]);

  // Type initial (Revenus/Dépenses) passé depuis l'accueil.
  useEffect(() => {
    const state = location.state as any;
    if (state?.initialType === "income" || state?.initialType === "expense") {
      setType(state.initialType);
    }
    // On ne relit ce réglage qu'au montage : ensuite l'utilisateur
    // bascule librement avec les onglets Dépense / Revenu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start voice if navigated with autoVoice flag
  useEffect(() => {
    const state = location.state as any;
    if (state?.autoVoice && !isRecording && !isProcessing) {
      // Small delay to ensure component is mounted
      setVoiceSheetOpen(true);
      const timer = setTimeout(() => startRecording(), 500);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const filteredCategories = categories.filter(c => c.type === type);

  const selectedCategory = filteredCategories.find((c: any) => c.id === categoryId) || null;
  const selectedWallet = wallets.find((w: any) => w.id === walletId) || null;

  const dateLabel = (() => {
    const iso = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString().split("T")[0];
    };
    if (date === iso(0)) return "Aujourd'hui";
    if (date === iso(1)) return "Hier";
    if (date === iso(2)) return "Avant-hier";
    const d = new Date(date + "T00:00:00");
    return isNaN(d.getTime())
      ? "Date"
      : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  })();

  const HALLUCINATIONS = [
    "merci", "merci.", "sous-titres", "sous-titrage",
    "transcription", "music", "musique", "♪",
    "thank you", "thanks for watching", "you",
    ".", " ", "...", "bonjour.", "bonsoir.",
  ];

  const isHallucination = (text: string): boolean => {
    const c = text.toLowerCase().trim();
    if (c.length < 4) return true;
    if (HALLUCINATIONS.some(h => c === h || c === h + ".")) return true;
    const words = c.split(" ");
    if (words.length > 4) {
      const uniqueWords = new Set(words);
      if (uniqueWords.size / words.length < 0.4) return true;
    }
    return false;
  };

  const getSupportedMimeType = () => {
    if (typeof MediaRecorder !== "undefined") {
      if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
      if (MediaRecorder.isTypeSupported("audio/ogg")) return "audio/ogg";
    }
    return "";
  };

  useEffect(() => {
    if (!isRecording || isPaused) return;
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording, isPaused]);

  const startRecording = async () => {
    // Quota vocal déjà épuisé : on le dit avant de faire parler l'utilisateur.
    if (isExhausted(usage?.voice)) {
      setVoiceSheetOpen(false);
      showLimit("voice", usage?.voice);
      return;
    }
    try {
      setTranscriptText(null);
      setShowRetryVoice(false);
      setElapsed(0);
      setIsPaused(false);
      cancelledRef.current = false;
      live.start();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setActiveStream(stream);
      const mimeType = getSupportedMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setActiveStream(null);
        live.stop();

        // Annulation explicite : on jette l'audio sans rien envoyer
        if (cancelledRef.current) {
          chunksRef.current = [];
          setIsRecording(false);
          setIsPaused(false);
          setElapsed(0);
          setVoiceSheetOpen(false);
          return;
        }
        const blob = new Blob(chunksRef.current, { type: getSupportedMimeType() || "audio/webm" });

        if (blob.size < 8000) {
          toast({
            title: "Trop court",
            description: "Parle pendant au moins 2 secondes",
            variant: "destructive",
          });
          setIsRecording(false);
          return;
        }
        
        if (!validatePayloadSize(blob, MAX_AUDIO_SIZE_BYTES)) {
          toast({ title: "Audio trop volumineux", description: "Maximum 10 Mo", variant: "destructive" });
          return;
        }
        await processVoice(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      // Le message générique masquait la cause réelle. On distingue les cas
      // pour que l'utilisateur sache quoi faire, et on journalise le détail.
      console.error("[micro]", err);
      const name = (err as { name?: string })?.name || "";

      let title = "Microphone non disponible";
      let description = "Vérifie que ton navigateur autorise le micro.";

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        title = "Accès au micro refusé";
        description = "Autorise le micro dans les réglages du navigateur, puis réessaie.";
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        title = "Aucun micro détecté";
        description = "Ton appareil ne semble pas avoir de micro disponible.";
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        title = "Micro déjà utilisé";
        description = "Ferme les autres applications qui utilisent le micro.";
      } else if (name === "SecurityError") {
        title = "Connexion non sécurisée";
        description = "Le micro exige une connexion HTTPS.";
      } else if (typeof MediaRecorder === "undefined") {
        title = "Navigateur incompatible";
        description = "Essaie avec Chrome ou Safari à jour.";
      }

      toast({ title, description, variant: "destructive" });
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && (rec.state === "recording" || rec.state === "paused")) {
      rec.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const pauseRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec?.state === "recording") {
      rec.pause();
      setIsPaused(true);
      live.pause();
    }
  };

  const resumeRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec?.state === "paused") {
      rec.resume();
      setIsPaused(false);
      live.resume();
    }
  };

  const cancelRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && (rec.state === "recording" || rec.state === "paused")) {
      cancelledRef.current = true;
      rec.stop();
    } else {
      setVoiceSheetOpen(false);
      setIsRecording(false);
      setIsPaused(false);
      setElapsed(0);
      live.stop();
    }
  };

  const matchCategoryId = (name: string, txType: string): string => {
    const match = categories.find(c =>
      c.name.toLowerCase() === name.toLowerCase() && c.type === txType
    );
    if (match) return match.id;
    const fuzzy = categories.find(c =>
      c.type === txType && c.name.toLowerCase().includes(name.toLowerCase())
    );
    return fuzzy?.id || "";
  };

  const matchWalletId = (name: string | null): string => {
    if (!name) return "";
    const match = wallets.find(w =>
      w.wallet_name.toLowerCase() === name.toLowerCase()
    );
    if (match) return match.id;
    const fuzzy = wallets.find(w =>
      w.wallet_name.toLowerCase().includes(name.toLowerCase())
    );
    return fuzzy?.id || "";
  };

  const processVoice = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      if (user) {
        const quota = await consumeFeature(user.id, "voice");
        if (!quota.allowed) {
          showLimit("voice", quota);
          return;
        }
      }
      const sttUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speech-to-text`;
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("audio", audioBlob, "voice.webm");

      const sttResp = await fetch(sttUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      });

      if (!sttResp.ok) {
        const errBody = await sttResp.json().catch(() => ({}));
        throw new Error(errBody.error || "Transcription échouée");
      }

      const sttData = await sttResp.json();
      const transcript = sttData?.transcript;

      if (sttData?.empty === true || !transcript?.trim() || isHallucination(transcript)) {
        setTranscriptText(null);
        toast({
          title: "Rien détecté",
          description: "Parle clairement et plus près du micro",
          variant: "destructive",
        });
        setShowRetryVoice(true);
        setIsProcessing(false);
        return;
      }

      // Show transcription bubble before AI processing
      setTranscriptText(transcript);

      const parseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-voice`;
      const { data: { session: parseSession } } = await supabase.auth.getSession();
      const parseResp = await fetch(parseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${parseSession?.access_token}`,
        },
        body: JSON.stringify({
          transcript,
          categories: categories.map(c => ({ name: c.name, type: c.type, id: c.id })),
          wallets: wallets.map(w => ({ wallet_name: w.wallet_name, id: w.id })),
        }),
      });

      if (!parseResp.ok) {
        const errBody = await parseResp.json().catch(() => ({}));
        throw new Error(errBody.error || "Analyse IA échouée");
      }

      const parseData = await parseResp.json();
      const parsed = parseData?.parsed;

      if (!parsed?.transactions?.length) throw new Error("Aucune transaction détectée");

      const mappedTxs: ParsedTransaction[] = parsed.transactions.map((tx: any) => ({
        amount: tx.amount || 0,
        type: tx.type || "expense",
        category: tx.category || "",
        wallet: tx.wallet || null,
        note: tx.note || "",
        currency: tx.currency || "XOF",
        date: tx.date || null,
        categoryId: matchCategoryId(tx.category || "", tx.type || "expense"),
        walletId: matchWalletId(tx.wallet),
      }));

      setVoiceTransactions(mappedTxs);

    } catch (err: any) {
      console.error("processVoice error:", err);
      toast({ title: "Erreur vocale", description: err?.message || "Réessaie en parlant plus clairement", variant: "destructive" });
      setShowRetryVoice(true);
    } finally {
      setIsProcessing(false);
      setVoiceSheetOpen(false);
      setElapsed(0);
    }
  };

  const handleVoiceConfirm = async (transactions: ParsedTransaction[]) => {
    if (!user) return;
    setIsSubmittingVoice(true);

    try {
      const today = new Date().toISOString().split("T")[0];

      for (const tx of transactions) {
        const catId = tx.categoryId || matchCategoryId(tx.category, tx.type);
        const walId = tx.walletId || matchWalletId(tx.wallet);

        let finalAmount = tx.amount;
        let originalAmount: number | null = null;
        let originalCurrency: string | null = null;
        let convertedAmountXof: number | null = null;
        let exchangeRateUsed: number | null = null;
        let exchangeRateSource: string | null = null;

        if (tx.currency && tx.currency !== "XOF") {
          originalAmount = tx.amount;
          originalCurrency = tx.currency;

          try {
            const convResp = await supabase.functions.invoke("convert-currency", {
              body: { amount: tx.amount, from: tx.currency, to: "XOF" },
            });
            if (convResp.data?.convertedAmount) {
              finalAmount = Math.round(convResp.data.convertedAmount);
              convertedAmountXof = finalAmount;
              exchangeRateUsed = convResp.data.rate;
              exchangeRateSource = convResp.data.source || "api";
            }
          } catch {
            toast({ title: `Conversion ${tx.currency}→XOF échouée, montant conservé`, variant: "destructive" });
          }
        }

        await supabase.from("transactions").insert({
          user_id: user.id,
          type: tx.type,
          amount: finalAmount,
          note: tx.note,
          date: tx.date || today,
          category_id: catId || null,
          wallet_id: walId || null,
          original_amount: originalAmount,
          original_currency: originalCurrency,
          converted_amount_xof: convertedAmountXof,
          exchange_rate_used: exchangeRateUsed,
          exchange_rate_source: exchangeRateSource,
          source: "voice",
        });
      }

      toast({ title: `${transactions.length} transaction${transactions.length > 1 ? "s" : ""} enregistrée${transactions.length > 1 ? "s" : ""}` });
      import("@/lib/petReminders").then((m) => m.rearmPetReminder()).catch(() => {});
      const today2 = new Date();
      const m2 = today2.getMonth() + 1;
      const y2 = today2.getFullYear();
      for (const tx of transactions) {
        const catId = tx.categoryId || matchCategoryId(tx.category, tx.type);
        const walId = tx.walletId || matchWalletId(tx.wallet);
        checkAndCreateNotifications(user.id, tx.type, catId || null, walId || null);
        // Auto-ajustement budget catégorie (fire-and-forget)
        if (tx.type === "expense" && catId) {
          syncAutoBudget(user.id, catId, m2, y2).catch((e) =>
            console.error("auto-budget voice error:", e)
          );
        }
      }
      setVoiceTransactions(null);
      setTranscriptText(null);
      navigate("/transactions");
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingVoice(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !user) return;

    if (wallets.length > 0 && !walletId) {
      toast({
        title: "Portefeuille requis",
        description: "Sélectionne le portefeuille utilisé",
        variant: "destructive",
      });
      return;
    }

    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      toast({ title: amountCheck.error || "Montant invalide", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type,
      amount: amountCheck.value,
      note: sanitizeNote(note),
      date,
      category_id: categoryId,
      wallet_id: walletId || null,
      source: "manual",
    });

    setLoading(false);
    if (error && isFreePlanLimitError(error)) {
      showLimit("manual_expense", quotaFromLimitError(error) ?? manualQuota);
      refreshUsage();
    } else if (error) {
      toast({ title: "Erreur", description: "Impossible d'enregistrer la transaction", variant: "destructive" });
    } else {
      refreshUsage();
      toast({ title: "Transaction enregistrée" });
      checkAndCreateNotifications(user.id, type, categoryId, walletId || null);
      import("@/lib/petReminders").then((m) => m.rearmPetReminder()).catch(() => {});
      // Auto-ajustement budget catégorie (fire-and-forget)
      if (type === "expense" && categoryId) {
        const d = new Date(date);
        syncAutoBudget(
          user.id,
          categoryId,
          d.getMonth() + 1,
          d.getFullYear()
        ).catch((e) => console.error("auto-budget error:", e));
      }
      // Alertes WhatsApp budget (fire-and-forget, débouncé)
      if (type === "expense") {
        setTimeout(async () => {
          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("phone, whatsapp_alerts")
              .eq("user_id", user.id)
              .maybeSingle();
            if (profile?.phone && profile.whatsapp_alerts !== false) {
              const d = new Date(date);
              await checkBudgetWhatsappAlerts({
                userId: user.id,
                userPhone: profile.phone,
                month: d.getMonth() + 1,
                year: d.getFullYear(),
              });
            }
          } catch (e) {
            console.error("WhatsApp alerts error:", e);
          }
        }, 1200);
      }
      navigate("/transactions");
    }
  };

  return (
    <DashboardLayout
      fullHeight
      hideBell
      showBack
      title={type === "expense" ? "Nouvelle dépense" : "Nouveau revenu"}
    >
      {/* La hauteur est gérée par DashboardLayout en mode fullHeight :
          l'en-tête et la barre du bas sont déduits une seule fois. */}
      <Screen className="flex-1 min-h-0">
        {/* Pas de paddingBottom forcé : Screen.Content réserve déjà la place
            de la barre de navigation et du bouton « C'est bon ». La forcer à
            zéro faisait passer la dernière rangée du clavier sous le bouton. */}
        <Screen.Content className="flex flex-col min-h-0">

      {/* Transcription bubble */}
      <AnimatePresence>
        {transcriptText && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="glass-card rounded-2xl p-3 mb-4 border border-primary/20"
          >
            <p className="text-xs text-muted-foreground mb-1">Texte reconnu :</p>
            <p className="text-sm text-foreground font-medium italic">« {transcriptText} »</p>
            {isProcessing && (
              <div className="flex items-center gap-2 mt-2">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Analyse par l'IA...</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Retry voice prompt */}
      <AnimatePresence>
        {showRetryVoice && !voiceTransactions && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card rounded-2xl p-4 mb-4 flex flex-col gap-3"
          >
              <p className="text-sm text-center text-muted-foreground">
                Je n'ai pas saisi ta dépense.
            </p>
              <p className="text-xs text-primary text-center font-medium">
                Exemple : "Taxi 3000 francs Wave"
            </p>
            <div className="flex gap-2">
              <Button
                  variant="glass"
                className="flex-1"
                onClick={() => setShowRetryVoice(false)}
              >
                Annuler
              </Button>
              <Button
                  variant="hero"
                className="flex-1"
                onClick={() => {
                  setShowRetryVoice(false);
                  startRecording();
                }}
              >
                Réessayer
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversational AI Confirmation */}
      <AnimatePresence>
        {voiceTransactions && (
          <VoiceConfirmationDialog
            transactions={voiceTransactions}
            categories={categories.map(c => ({ id: c.id, name: c.name, type: c.type }))}
            wallets={wallets.map(w => ({ id: w.id, wallet_name: w.wallet_name }))}
            onConfirm={handleVoiceConfirm}
            onCancel={() => { setVoiceTransactions(null); setTranscriptText(null); }}
            isSubmitting={isSubmittingVoice}
          />
        )}
      </AnimatePresence>

      {/* Manual form */}
      {!voiceTransactions && (
        <>
          <div className="flex gap-1 p-1 glass-card rounded-xl mb-3">
            <button onClick={() => setType("expense")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${type === "expense" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground"}`}>
              Dépense
            </button>
            <button onClick={() => setType("income")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${type === "income" ? "gradient-primary text-primary-foreground" : "text-muted-foreground"}`}>
              Revenu
            </button>
          </div>

          {type === "expense" && manualLeft !== null && manualLeft <= 5 && (
            <button
              type="button"
              onClick={() => showLimit("manual_expense", manualQuota)}
              className={`mx-auto mb-2 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                manualLeft === 0 ? "bg-destructive/15 text-destructive" : "bg-accent/15 text-accent"
              }`}
            >
              {manualLeft === 0
                ? "Plus de saisie ce mois"
                : `Il te reste ${manualLeft} saisie${manualLeft > 1 ? "s" : ""} ce mois`}
              {!isStoreApp() && " · Passer à Pro"}
            </button>
          )}

          {/* flex flex-col min-h-0 est indispensable : sans ça, la chaîne
              de contraintes est rompue entre Screen.Content et le clavier,
              qui déborde alors sous le bouton au lieu de se comprimer. */}
          <form id="new-tx-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
            <p className="text-center text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
              Montant
            </p>
            {/* Montant : le montant EST l'écran, et il est éditable */}
            <AmountDisplay
              value={amount}
              onChange={setAmount}
              onCaretChange={setAmountCaret}
              className="pt-1 pb-1"
            />

            {/* flex-wrap et non une grille : chaque pastille prend la largeur
                de son texte et l'ensemble se centre, comme dans la maquette.
                Une grille 2 colonnes les forçait toutes à la demi-largeur. */}
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              <MetaChip
                icon={
                  selectedCategory
                    ? getCatIcon(selectedCategory.name || "", type)
                    : <StickyNote className="w-4 h-4" />
                }
                label={selectedCategory?.name || "Catégorie"}
                empty={!selectedCategory}
                onClick={() => setShowCatSheet(true)}
              />
              <MetaChip
                icon={<CreditCard className="w-4 h-4" />}
                label={selectedWallet?.wallet_name || "Moyen de paiement"}
                empty={!selectedWallet}
                onClick={() => setShowWalletSheet(true)}
              />
              <MetaChip
                icon={<CalendarDays className="w-4 h-4" />}
                label={dateLabel}
                onClick={() => setShowDateSheet(true)}
              />
              <MetaChip
                icon={<StickyNote className="w-4 h-4" />}
                label={note ? note : "Note"}
                empty={!note}
                onClick={() => setShowNote((v) => !v)}
              />
            </div>

            {showNote && (
              <div className="mt-3">
                <Textarea
                  placeholder="Détails de la transaction..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="bg-secondary border-border"
                  autoFocus
                />
              </div>
            )}

            {/* mt-auto cale le clavier et le bouton en bas de l'espace restant.
                Le clavier ne s'étire plus : sa hauteur lui est propre, il ne
                peut donc plus être écrasé par ce qu'on ajoute au-dessus. */}
            <AmountKeypad
              value={amount}
              onChange={setAmount}
              caret={amountCaret}
              onCaretChange={setAmountCaret}
              className="mt-4 sm:mt-5"
            />

            <Button
              type="submit"
              variant="hero"
              className="mt-4 h-[52px] w-full rounded-2xl text-base font-extrabold"
              disabled={loading}
            >
              {loading ? "Un instant…" : (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  C'est bon
                </>
              )}
            </Button>

          </form>
        </>
      )}
        </Screen.Content>

        <VoiceRecorderSheet
          open={voiceSheetOpen}
          isRecording={isRecording}
          isPaused={isPaused}
          isProcessing={isProcessing}
          elapsed={elapsed}
          stream={activeStream}
          transcriptFinal={live.final}
          transcriptPartial={live.partial}
          transcriptSupported={live.supported}
          onStart={startRecording}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onStop={stopRecording}
          onCancel={cancelRecording}
          onWriteInstead={() => {
            // On ferme simplement le vocal : le clavier de saisie est déjà
            // là, en dessous. Inutile de naviguer ailleurs.
            setVoiceSheetOpen(false);
          }}
        />
        <CategorySheet
          open={showCatSheet}
          onOpenChange={setShowCatSheet}
          categories={filteredCategories}
          value={categoryId}
          onSelect={setCategoryId}
          type={type}
        />
        <WalletSheet
          open={showWalletSheet}
          onOpenChange={setShowWalletSheet}
          wallets={wallets}
          value={walletId}
          onSelect={setWalletId}
        />
        <DateSheet
          open={showDateSheet}
          onOpenChange={setShowDateSheet}
          value={date}
          onSelect={setDate}
        />
      </Screen>
      <UpgradeSheet
        open={!!upgrade}
        onOpenChange={(o) => { if (!o) setUpgrade(null); }}
        title={upgrade?.title ?? ""}
        description={upgrade?.description ?? ""}
        currentPlan={upgrade?.plan}
      />
    </DashboardLayout>
  );
};

export default NewTransaction;
