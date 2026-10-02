import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ImagePlus, Loader2, RefreshCw, ShieldCheck, Wallet as WalletIcon } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import UpgradeSheet from "@/components/UpgradeSheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { compressReceipt, fileToBase64 } from "@/lib/imageCompression";
import { limitReachedMessage, type FeatureQuota } from "@/lib/freePlan";
import { normalizeCategoryName } from "@/lib/categoryMatch";
import { useHideFab } from "@/lib/fabVisibility";

/**
 * Import des « Tendances » Wave : l'utilisateur fait une capture de ses
 * dépenses du mois par catégorie dans Wave, l'IA la lit, et chaque catégorie
 * devient une dépense du mois dans Mon Jeton (origine « import »).
 *
 * Réimporter le même mois REMPLACE l'import précédent : la capture est un
 * instantané du mois, pas une liste de nouvelles dépenses.
 */

type ScanCategory = { label: string; amount: number; category: string; existing: boolean };
type ScanResult = {
  is_wave_trends: boolean;
  period: "month" | "week" | "unknown";
  month: number;
  year: number;
  month_label: string;
  month_out_of_range: boolean;
  total: number | null;
  sum: number;
  sum_matches: boolean;
  categories: ScanCategory[];
  warnings: string[];
};
type Row = ScanCategory & { selected: boolean; categoryName: string };
type Category = { id: string; name: string; type: string };
type Wallet = { id: string; wallet_name: string };

const NOTE_PREFIX = "Wave · ";
const SEND_MONEY = "Envois d'argent";
const NO_WALLET = "__none__";
const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} F`;
const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Les « Transferts » Wave sont des envois à des personnes, pas des virements entre tes portefeuilles. */
const isWaveTransfer = (label: string) => /^(transfers?|transferts?|envois?)\b/.test(normalizeCategoryName(label));

function monthBounds(month: number, year: number) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const now = new Date();
  const isCurrent = now.getFullYear() === year && now.getMonth() === month - 1;
  return { start: localDate(first), end: localDate(last), entryDate: isCurrent ? localDate(now) : localDate(last) };
}

const WaveImport = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"intro" | "reading" | "review" | "saving" | "done">("intro");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState<string>(NO_WALLET);
  const [previousCount, setPreviousCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<{ title: string; description: string; plan?: string } | null>(null);
  // Le « + » flottant recouvrirait le portefeuille et le bouton d'enregistrement.
  useHideFab(step === "review" || step === "saving");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("categories").select("id, name, type").eq("user_id", user.id),
      supabase.from("wallets").select("id, wallet_name").eq("user_id", user.id),
    ]).then(([catRes, walRes]) => {
      setCategories((catRes.data as Category[]) || []);
      const ws = (walRes.data as Wallet[]) || [];
      setWallets(ws);
      const wave = ws.find((w) => /wave/i.test(w.wallet_name));
      if (wave) setWalletId(wave.id);
    });
  }, [user]);

  const expenseCategories = useMemo(() => categories.filter((c) => c.type === "expense"), [categories]);
  const selected = rows.filter((r) => r.selected && r.amount > 0);
  const selectedTotal = selected.reduce((s, r) => s + r.amount, 0);

  const pickFile = () => {
    setError(null);
    fileRef.current?.click();
  };

  const readScreenshot = async (file: File) => {
    if (!user) return;
    setStep("reading");
    setError(null);
    try {
      let toSend: File = file;
      try {
        toSend = (await compressReceipt(file)).archive;
      } catch {
        /* format exotique : on envoie l'original */
      }
      const base64 = await fileToBase64(toSend);
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-wave-trends`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: toSend.type || "image/jpeg" }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 402 && body.error === "quota") {
        const q = body.quota ?? {};
        const quota: FeatureQuota = {
          allowed: false, unlimited: false, used: Number(q.used ?? 0),
          limit: q.limit == null ? null : Number(q.limit), resetsAt: q.resets_at ?? null, plan: q.plan,
        };
        setUpgrade({ ...limitReachedMessage("scan", quota), plan: quota.plan });
        setStep("intro");
        return;
      }
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

      const scan = body as ScanResult;
      if (!scan.is_wave_trends) {
        setError("Ce n’est pas l’écran « Tendances » de Wave. Ouvre Wave, va dans Tendances, choisis « Mois », puis refais la capture.");
        setStep("intro");
        return;
      }
      setResult(scan);
      setRows(
        scan.categories.map((c) => ({
          ...c,
          selected: true,
          categoryName: isWaveTransfer(c.label) ? SEND_MONEY : c.category,
        })),
      );
      const { start, end } = monthBounds(scan.month, scan.year);
      const { count } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("source", "import")
        .like("note", `${NOTE_PREFIX}%`)
        .gte("date", start)
        .lte("date", end);
      setPreviousCount(count ?? 0);
      setStep("review");
    } catch (e) {
      console.warn("[WaveImport]", e);
      setError("La capture n’a pas pu être lue. Vérifie ta connexion et réessaie avec une image nette.");
      setStep("intro");
    }
  };

  /** Catégorie existante, sinon créée (ex. « Envois d'argent »). */
  const resolveCategoryId = async (name: string, cache: Map<string, string>) => {
    const key = normalizeCategoryName(name);
    if (cache.has(key)) return cache.get(key)!;
    const found = expenseCategories.find((c) => normalizeCategoryName(c.name) === key);
    if (found) {
      cache.set(key, found.id);
      return found.id;
    }
    const { data, error: insErr } = await supabase
      .from("categories")
      .insert({ user_id: user!.id, name: name.slice(0, 50), type: "expense", icon: name === SEND_MONEY ? "Send" : null, color: "hsl(150, 60%, 45%)" })
      .select("id")
      .single();
    if (insErr || !data) throw insErr ?? new Error("category");
    cache.set(key, data.id);
    return data.id as string;
  };

  const save = async () => {
    if (!user || !result || selected.length === 0) return;
    setStep("saving");
    try {
      const { start, end, entryDate } = monthBounds(result.month, result.year);
      // Ancien import du même mois : supprimé seulement APRÈS l'enregistrement du nouveau.
      const { data: previous } = await supabase
        .from("transactions")
        .select("id")
        .eq("user_id", user.id)
        .eq("source", "import")
        .like("note", `${NOTE_PREFIX}%`)
        .gte("date", start)
        .lte("date", end);

      const cache = new Map<string, string>();
      const inserts = [];
      for (const r of selected) {
        inserts.push({
          user_id: user.id,
          type: "expense",
          amount: r.amount,
          date: entryDate,
          note: `${NOTE_PREFIX}${r.label} — tendances ${result.month_label}`,
          category_id: await resolveCategoryId(r.categoryName, cache),
          wallet_id: walletId === NO_WALLET ? null : walletId,
          source: "import",
        });
      }
      const { error: insErr } = await supabase.from("transactions").insert(inserts);
      if (insErr) throw insErr;

      const oldIds = (previous ?? []).map((p) => p.id);
      if (oldIds.length) await supabase.from("transactions").delete().in("id", oldIds);
      setStep("done");
    } catch (e) {
      console.warn("[WaveImport save]", e);
      toast({ title: "Enregistrement impossible", description: "Rien n’a été modifié. Réessaie dans un instant.", variant: "destructive" });
      setStep("review");
    }
  };

  const reset = () => {
    setResult(null);
    setRows([]);
    setError(null);
    setStep("intro");
  };

  return (
    <DashboardLayout title="Importer depuis Wave" showBack backTo="/scan">
      <input
        ref={fileRef}
        id="wave-capture"
        aria-label="Capture d’écran Wave"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) readScreenshot(f);
        }}
      />

      {step === "intro" && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <img src="/assets/pay/wave.svg" alt="" className="w-11 h-11 rounded-xl" />
              <div>
                <h2 className="font-display text-lg font-extrabold leading-tight">Tes dépenses Wave du mois, en une capture</h2>
                <p className="text-sm text-muted-foreground">Mon Jeton démarre ton mois avec tes vrais chiffres.</p>
              </div>
            </div>
            <ol className="mt-5 space-y-3">
              {[
                "Ouvre Wave et va dans « Tendances » (Trends).",
                "Choisis « Mois » (Month).",
                "Fais une capture d’écran et choisis-la ici.",
              ].map((t, i) => (
                <li key={t} className="flex items-start gap-3 text-sm">
                  <span className="w-7 h-7 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="pt-1">{t}</span>
                </li>
              ))}
            </ol>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex gap-2" role="alert">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button className="w-full h-12 gradient-primary text-primary-foreground font-bold" onClick={pickFile}>
            <ImagePlus className="w-5 h-5 mr-2" /> Choisir ma capture Wave
          </Button>
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
            Mon Jeton ne se connecte pas à ton compte Wave : seule ta capture est lue. Un import compte pour 1 scan IA.
          </p>
        </div>
      )}

      {step === "reading" && (
        <div className="glass-card rounded-2xl p-8 flex flex-col items-center gap-3 text-center" aria-busy="true">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="font-semibold">Lecture de ta capture…</p>
          <p className="text-sm text-muted-foreground">On repère chaque catégorie et son montant.</p>
        </div>
      )}

      {(step === "review" || step === "saving") && result && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dépenses Wave · {result.month_label}</p>
            <p className="font-display text-3xl font-extrabold mt-1 tabular-nums">{fmt(result.total ?? result.sum)}</p>
            {result.sum_matches && (
              <p className="text-xs text-primary mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Total vérifié : les catégories correspondent
              </p>
            )}
          </div>

          {(result.period === "week" || !result.sum_matches || result.month_out_of_range) && (
            <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 text-sm space-y-1" role="alert">
              {result.period === "week" && <p>Ta capture montre une <strong>semaine</strong>, pas le mois. Pour une base complète, choisis « Mois » dans Wave.</p>}
              {!result.sum_matches && (
                <p>
                  Les catégories font {fmt(result.sum)}
                  {result.total != null && <> alors que le total affiché est {fmt(result.total)}</>}. Vérifie les montants ci-dessous.
                </p>
              )}
              {result.month_out_of_range && <p>Le mois lu ne correspond pas aux 12 derniers mois. Vérifie ta capture.</p>}
            </div>
          )}

          <div className="glass-card rounded-2xl divide-y divide-border">
            {rows.map((r, i) => (
              <div key={`${r.label}-${i}`} className="p-4 flex items-start gap-3">
                <Checkbox
                  checked={r.selected}
                  onCheckedChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, selected: v === true } : x)))}
                  aria-label={`Importer ${r.label}`}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold truncate">{r.label}</span>
                    <label className="flex items-center gap-1">
                      <span className="sr-only">Montant {r.label}</span>
                      <input
                        inputMode="numeric"
                        className="w-28 text-right bg-secondary rounded-lg px-2 py-1.5 font-bold tabular-nums"
                        value={r.amount ? r.amount.toLocaleString("fr-FR") : ""}
                        onChange={(e) => {
                          const n = Number(e.target.value.replace(/\D/g, "")) || 0;
                          setRows((rs) => rs.map((x, j) => (j === i ? { ...x, amount: n } : x)));
                        }}
                      />
                      <span className="text-sm text-muted-foreground">F</span>
                    </label>
                  </div>
                  <Select
                    value={r.categoryName}
                    onValueChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, categoryName: v } : x)))}
                  >
                    <SelectTrigger className="h-9 text-sm" aria-label={`Catégorie pour ${r.label}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {!expenseCategories.some((c) => normalizeCategoryName(c.name) === normalizeCategoryName(r.categoryName)) && (
                        <SelectItem value={r.categoryName}>{r.categoryName} (nouvelle)</SelectItem>
                      )}
                      {expenseCategories.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          {wallets.length > 0 && (
            <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <WalletIcon className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-sm font-semibold flex-1">Portefeuille</span>
              <Select value={walletId} onValueChange={setWalletId}>
                <SelectTrigger className="w-44 h-9 text-sm" aria-label="Portefeuille">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_WALLET}>Aucun</SelectItem>
                  {wallets.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.wallet_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {previousCount > 0 && (
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <RefreshCw className="w-4 h-4 flex-shrink-0" />
              Tu as déjà importé {result.month_label}. Ce nouvel import remplacera le précédent, sans doublon.
            </p>
          )}

          <Button
            className="w-full h-12 gradient-primary text-primary-foreground font-bold"
            disabled={selected.length === 0 || step === "saving"}
            onClick={save}
          >
            {step === "saving" ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Enregistrer {selected.length} catégorie{selected.length > 1 ? "s" : ""} · {fmt(selectedTotal)}</>}
          </Button>
          <Button variant="ghost" className="w-full" onClick={reset} disabled={step === "saving"}>
            Choisir une autre capture
          </Button>
        </div>
      )}

      {step === "done" && result && (
        <div className="glass-card rounded-2xl p-6 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
          <div>
            <h2 className="font-display text-xl font-extrabold">Ton mois Wave est importé</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {fmt(selectedTotal)} de dépenses Wave en {result.month_label}. Ajoute maintenant seulement tes dépenses en espèces et
              celles des autres moyens de paiement, pour ne rien compter deux fois.
            </p>
          </div>
          <Button className="w-full h-12 gradient-primary text-primary-foreground font-bold" onClick={() => navigate("/transactions/new")}>
            Ajouter une dépense en espèces
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>
            Voir mon tableau de bord
          </Button>
        </div>
      )}

      <UpgradeSheet
        open={!!upgrade}
        onOpenChange={(o) => !o && setUpgrade(null)}
        title={upgrade?.title ?? ""}
        description={upgrade?.description ?? ""}
        currentPlan={upgrade?.plan}
      />
    </DashboardLayout>
  );
};

export default WaveImport;
