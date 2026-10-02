import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Camera, Upload, Receipt, ScanLine } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { compressReceipt, fileToBase64 } from "@/lib/imageCompression";
import { consumeFeature, fetchMonthlyUsage, limitReachedMessage, formatResetDate, type FeatureQuota } from "@/lib/freePlan";
import UpgradeSheet from "@/components/UpgradeSheet";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

import ScanResultCard, { type ParsedResult } from "@/components/scan/ScanResultCard";
import { MultiReceiptValidator } from "@/components/scan/MultiReceiptValidator";
import { ScanProgress } from "@/components/scan/ScanProgress";
import { useActiveCurrency } from "@/lib/currencyStore";

const FREE_SCAN_LIMIT = 5;

interface DetectedTransaction {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  type: 'expense' | 'income';
  category_suggestion: string;
  note: string;
  confidence: number;
  raw_text: string;
  issues: string;
}

interface MultiScanResult {
  document_type: string;
  total_detected: number;
  transactions: DetectedTransaction[];
  global_confidence: number;
  warnings: string[];
}

const getScanCount = (): { count: number; month: string } => {
  const now = new Date();
  const key = "scan_counter";
  const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "{}");
    if (stored.month === currentMonth) return stored;
  } catch {}
  return { count: 0, month: currentMonth };
};

const incrementScanCount = () => {
  const data = getScanCount();
  data.count += 1;
  localStorage.setItem("scan_counter", JSON.stringify(data));
};

const Scan = () => {
  const { user, isAdmin } = useAuth();
  const activeCurrency = useActiveCurrency();
  const [totalConfirmed, setTotalConfirmed] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  // null = scans illimités (Ultra Pro, admin). Gratuit : 5 / mois, Pro : 30 / mois.
  const [scanLimit, setScanLimit] = useState<number | null>(FREE_SCAN_LIMIT);
  const [scansRemaining, setScansRemaining] = useState(FREE_SCAN_LIMIT);
  const [upgrade, setUpgrade] = useState<{ title: string; description: string; plan?: string } | null>(null);
  const [resetLabel, setResetLabel] = useState<string>("");
  const [history, setHistory] = useState<any[]>([]);
  const [scanResult, setScanResult] = useState<ParsedResult | null>(null);
  const [multiScanResult, setMultiScanResult] = useState<MultiScanResult | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanStoragePath, setScanStoragePath] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("receipt_scans")
      .select("id,scan_type,parsed_amount,parsed_merchant,parsed_category,parsed_date,parsed_currency,image_url,status,created_at,storage_path")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
  }, [user]);

  const refreshReceiptStats = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("receipt_scans")
      .select("parsed_amount, status")
      .eq("user_id", user.id)
      .eq("status", "confirmed");
    const confirmed = data || [];
    setTotalConfirmed(confirmed.length);
    setTotalAmount(confirmed.reduce((s: number, r: any) => s + (r.parsed_amount || 0), 0));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("receipt_scans").select("parsed_amount, status").eq("user_id", user.id).eq("status", "confirmed"),
      supabase.from("categories").select("id, name, type").eq("user_id", user.id),
      supabase.from("wallets").select("id, wallet_name").eq("user_id", user.id),
    ]).then(([histRes, catRes, walRes]) => {
      const confirmed = histRes.data || [];
      setTotalConfirmed(confirmed.length);
      setTotalAmount(confirmed.reduce((s: number, r: any) => s + (r.parsed_amount || 0), 0));
      setCategories(catRes.data || []);
      setWallets(walRes.data || []);
    });
    fetchHistory();
    // Compteur serveur : partagé entre appareils, non réinitialisable en vidant
    // les données du navigateur. Le compteur local ne sert plus que de repli.
    fetchMonthlyUsage(user.id).then((usage) => {
      const scan = usage?.scan;
      if (isAdmin || (scan && scan.unlimited)) {
        setScanLimit(null);
      } else if (scan && scan.limit != null) {
        setScanLimit(scan.limit);
        setScansRemaining(Math.max(0, scan.limit - scan.used));
        setResetLabel(formatResetDate(scan.resetsAt));
      } else {
        setScansRemaining(FREE_SCAN_LIMIT - getScanCount().count);
      }
    });
  }, [user, fetchHistory, isAdmin]);

  const limited = scanLimit != null;
  const exhausted = limited && scansRemaining <= 0;

  const showLimit = (quota?: FeatureQuota) => {
    const msg = limitReachedMessage("scan", quota ?? {
      allowed: false, unlimited: false, used: scanLimit ?? 0, limit: scanLimit, resetsAt: null,
      plan: scanLimit === FREE_SCAN_LIMIT ? "free" : "pro",
    });
    setUpgrade({ ...msg, plan: quota?.plan ?? (scanLimit === FREE_SCAN_LIMIT ? "free" : "pro") });
  };

  // Limite atteinte : on explique et on propose le plan supérieur au lieu
  // d'un bouton grisé sans explication.
  const pickImage = (input: HTMLInputElement | null) => {
    if (exhausted) {
      showLimit();
      return;
    }
    input?.click();
  };

  const scanImage = async (file: File) => {
    if (!user) return;

    // Décompte côté serveur, avant l'appel à l'IA : c'est lui qui fait foi.
    // Il s'applique à tous les plans (gratuit 5, Pro 30, Ultra Pro illimité).
    if (!isAdmin) {
      const quota = await consumeFeature(user.id, "scan");
      if (quota.unlimited) {
        setScanLimit(null);
      } else if (quota.limit != null) {
        setScanLimit(quota.limit);
        setScansRemaining(Math.max(0, quota.limit - quota.used));
        setResetLabel(formatResetDate(quota.resetsAt));
      }
      if (!quota.allowed) {
        showLimit(quota);
        return;
      }
    }

    setScanning(true);
    setScanResult(null);
    setMultiScanResult(null);
    setScanStoragePath(null);
    try {
      // L'IA reçoit TOUJOURS l'image d'origine (meilleure lecture OCR).
      const base64 = await fileToBase64(file);

      // Ce qu'on STOCKE est compressé : archive légère + vignette.
      // Si la compression échoue (format exotique), on retombe sur l'original.
      let processedFile: File = file;
      try {
        const { archive } = await compressReceipt(file);
        processedFile = archive;
      } catch (e) {
        console.warn('[Scan compression]', e);
      }

      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);

      // Upload image to private storage (best-effort, don't block the scan)
      let storagePath: string | null = null;
      try {
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const ext = (processedFile.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const uuid = (crypto as any)?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const path = `${user.id}/${ym}/${uuid}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('receipts')
          .upload(path, processedFile, { contentType: processedFile.type, upsert: false });
        if (!upErr) {
          storagePath = path;
          setScanStoragePath(path);
        } else {
          console.warn('[Scan upload]', upErr);
        }
      } catch (e) {
        console.warn('[Scan upload exception]', e);
      }

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-receipts`;

      console.log('[Scan request]', {
        imageSize: base64?.length,
        mediaType: processedFile.type,
        currency: activeCurrency,
      });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType: processedFile.type,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur scan (HTTP ${res.status})`);
      }

      const result: MultiScanResult = await res.json();
      const txs = result.transactions || [];

      if (txs.length === 0) {
        toast({
          title: 'Aucune transaction détectée',
          description: 'Essaie avec une image plus nette',
          variant: 'destructive',
        });
        return;
      }

      // Le crédit a déjà été décompté côté serveur avant l'appel au scan.

      // Routage automatique : 1 tx => ScanResultCard, 2+ => MultiReceiptValidator
      if (txs.length === 1) {
        const tx = txs[0];
        setScanResult({
          amount: tx.amount,
          date: tx.date,
          merchant: tx.merchant,
          type: tx.type,
          category: tx.category_suggestion,
          currency: tx.currency,
        });
        toast({
          title: 'Reçu analysé',
          description: 'Vérifie et valide les informations',
        });
      } else {
        setMultiScanResult(result);
        toast({
          title: `${txs.length} transactions détectées`,
          description: 'Sélectionne et valide ce que tu veux enregistrer',
        });
      }
    } catch (e: any) {
      const m = (e?.message || e?.error || '').toLowerCase();
      let desc = "Une erreur est survenue. Réessaie.";

      if (m.includes('rate') || m.includes('limit')) {
        desc = "Trop de scans en peu de temps. Attends 5 minutes.";
      } else if (m.includes('image') || m.includes('media')) {
        desc = "Image illisible. Vérifie qu'elle est bien éclairée et nette.";
      } else if (m.includes('currency') || m.includes('xof') || m.includes('eur')) {
        desc = "Problème de devise. Vérifie ta devise préférée dans Settings.";
      } else if (m.includes('anthropic') || m.includes('ai service') || m.includes('claude')) {
        desc = "Service IA temporairement indisponible. Réessaie dans 1 minute.";
      } else if (m.includes('auth') || m.includes('token')) {
        desc = "Session expirée. Reconnecte-toi.";
      } else if (m.includes('network') || m.includes('failed to fetch')) {
        desc = "Problème de connexion. Vérifie ton réseau.";
      } else if (e?.message) {
        desc = e.message;
      }

      toast({
        title: "Scan échoué",
        description: desc,
        variant: "destructive",
        duration: 6000,
      });

      console.error('[Scan error]', e);
    } finally {
      setScanning(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) await scanImage(f);
    e.target.value = "";
  };

  const findCategoryId = (name?: string | null, type: 'expense' | 'income' = 'expense') => {
    if (!name) return null;
    const match = categories.find(
      (c) => c.name?.toLowerCase() === name.toLowerCase() && (!c.type || c.type === type)
    ) || categories.find((c) => c.name?.toLowerCase() === name.toLowerCase());
    return match?.id ?? null;
  };

  const findWalletId = (name?: string | null) => {
    if (!name) return null;
    const match = wallets.find((w) => w.wallet_name?.toLowerCase() === name.toLowerCase());
    return match?.id ?? null;
  };

  const handleConfirm = async (data: ParsedResult) => {
    if (!user) return;
    try {
      const type = data.type === 'income' ? 'income' : 'expense';
      const amount = data.converted_amount_xof ?? data.amount ?? 0;
      const catId = findCategoryId(data.category, type);
      const walletId = findWalletId(data.wallet);

      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        amount,
        type,
        date: data.date || new Date().toISOString().slice(0, 10),
        note: data.merchant || 'Reçu scanné',
        category_id: catId,
        wallet_id: walletId,
        source: 'scan',
      } as any);

      if (error) throw error;

      await supabase.from('receipt_scans').insert({
        user_id: user.id,
        scan_type: 'photo',
        parsed_merchant: data.merchant,
        parsed_amount: amount,
        parsed_date: data.date,
        parsed_category: data.category,
        parsed_currency: data.currency,
        status: 'confirmed',
        storage_path: scanStoragePath,
      });

      toast({ title: 'Transaction enregistrée' });
      setScanResult(null);
      setImagePreview(null);
      setScanStoragePath(null);
      await Promise.all([fetchHistory(), refreshReceiptStats()]);
    } catch (e: any) {
      toast({
        title: 'Erreur enregistrement',
        description: e?.message,
        variant: 'destructive',
      });
    }
  };

  const handleReject = () => {
    setScanResult(null);
    setImagePreview(null);
    setScanStoragePath(null);
  };

  const handleMultiClose = () => {
    setMultiScanResult(null);
    setImagePreview(null);
    setScanStoragePath(null);
  };

  const handleMultiValidated = async (_count: number) => {
    setMultiScanResult(null);
    setImagePreview(null);
    setScanStoragePath(null);
    await Promise.all([fetchHistory(), refreshReceiptStats()]);
  };

  // Mode multi-scan : on prend tout l'écran (Screen géré par MultiReceiptValidator)
  if (multiScanResult) {
    return (
      <DashboardLayout title="Valider les transactions">
        <MultiReceiptValidator
          scanResult={multiScanResult}
          imagePreview={imagePreview}
          storagePath={scanStoragePath}
          onClose={handleMultiClose}
          onValidated={handleMultiValidated}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Scan Intelligent">
      {/* Compteur de scans du mois (plans gratuit et Pro) */}
      {limited && (
        <div className="glass-card rounded-xl p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {scansRemaining > 0
              ? `${scansRemaining} scan${scansRemaining > 1 ? "s" : ""} restant${scansRemaining > 1 ? "s" : ""} ce mois`
              : resetLabel
                ? `Limite atteinte — nouveaux scans le ${resetLabel}`
                : "Limite de scans atteinte ce mois"}
          </span>
          {scansRemaining <= 0 && (
            <Button onClick={() => showLimit()} size="sm" className="gradient-primary text-primary-foreground">
              {scanLimit === FREE_SCAN_LIMIT ? "Passer à Pro" : "Voir Ultra Pro"}
            </Button>
          )}
        </div>
      )}

      {/* Import des Tendances Wave : la base du mois en une capture */}
      {!scanResult && (
        <Link
          to="/import-wave"
          className="glass-card rounded-xl p-3.5 mb-4 flex items-center gap-3 border border-primary/20 hover:border-primary/40 transition-colors"
        >
          <img src="/assets/pay/wave.svg" alt="" className="w-10 h-10 rounded-lg flex-shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-foreground">Importer mes dépenses Wave du mois</span>
            <span className="block text-xs text-muted-foreground">Une capture de « Tendances » suffit</span>
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </Link>
      )}

      {scanResult ? (
        <ScanResultCard
          result={scanResult}
          categories={categories}
          wallets={wallets}
          onConfirm={handleConfirm}
          onReject={handleReject}
          isPremium={true}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl p-5 flex flex-col items-center gap-4 border-2 border-dashed border-primary/35"
          style={{ background: "linear-gradient(160deg, hsl(var(--primary) / 0.07), transparent 78%)" }}
        >
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center">
            <ScanLine className="w-6 h-6 text-primary-foreground" />
          </div>

          <div className="text-center space-y-1 max-w-xs">
            <h3 className="text-foreground font-bold text-[15px]">Scanne ton reçu</h3>
            <p className="text-[13px] text-muted-foreground leading-snug">
              Facture, reçu Mobile Money ou ticket de caisse. L'IA détecte les montants.
            </p>
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
            disabled={scanning || exhausted}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
            disabled={scanning || exhausted}
          />

          {scanning ? (
            <ScanProgress isAnalyzing={scanning} />
          ) : (
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button
                onClick={() => pickImage(cameraRef.current)}
                className="w-full gradient-primary text-primary-foreground"
              >
                <Camera className="w-4 h-4 mr-2" /> Photo
              </Button>
              <Button
                variant="outline"
                className="w-full glass"
                onClick={() => pickImage(galleryRef.current)}
              >
                <Upload className="w-4 h-4 mr-2" /> Galerie
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Photo nette et bien éclairée = meilleure précision
          </p>
        </motion.div>
      )}

      <Link
        to="/receipts"
        className="w-full glass-card rounded-xl p-3.5 flex items-center justify-between mt-6 border border-primary/20"
      >
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center shrink-0">
            <Receipt className="w-4 h-4 text-primary-foreground" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">Mes reçus</p>
            <p className="text-xs text-muted-foreground">
              {totalConfirmed} confirmé{totalConfirmed > 1 ? "s" : ""} · {totalAmount.toLocaleString("fr-FR")} total
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </Link>
      <UpgradeSheet
        open={!!upgrade}
        onOpenChange={(open) => !open && setUpgrade(null)}
        title={upgrade?.title ?? ""}
        description={upgrade?.description ?? ""}
        currentPlan={upgrade?.plan}
      />
    </DashboardLayout>
  );
};

export default Scan;
