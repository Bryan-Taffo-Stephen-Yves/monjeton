import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Check, Plus, X, Sparkles, Loader2, Lock, Minus,
  Scale, CheckCircle2, Wallet, AlertTriangle, PartyPopper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Screen } from "@/components/layout/Screen";
import { resolveCategoryIcon } from "@/lib/categoryIconMap";
import {
  FIXED_PRESETS, INCOME_CHOICES, categoryStyle, withAlpha, stepFor,
  planTotal, type PlanLine,
} from "@/lib/budgetPlan";

export type FixedCharge = { nom: string; montant: number };

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, " ");

/* ------------------------------------------------------------------ */
/* Éléments communs                                                    */
/* ------------------------------------------------------------------ */

function CategoryTile({ name, size = 40 }: { name: string; size?: number }) {
  const { icon, color } = categoryStyle(name);
  const Icon = resolveCategoryIcon(icon);
  return (
    <span
      className="flex-shrink-0 rounded-xl flex items-center justify-center"
      style={{ width: size, height: size, background: withAlpha(color, 0.16), color }}
      aria-hidden="true"
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} />
    </span>
  );
}

function StepHeader({
  step, title, subtitle, onBack, onCancel,
}: {
  step: 1 | 2 | 3;
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="pt-1">
      <div className="flex items-center gap-3 h-9">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Retour"
            className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : null}
        <div className="flex-1 flex items-center gap-1.5" aria-label={`Étape ${step} sur 3`}>
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-secondary"}`}
            />
          ))}
        </div>
        <span className="text-xs font-bold text-muted-foreground tabular-nums">{step}/3</span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground px-1"
          >
            Annuler
          </button>
        )}
      </div>
      <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.03em] mt-5">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-3"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="w-full max-w-sm bg-card border border-border rounded-3xl p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AddLineSheet({
  open, onClose, onAdd, title, hint, amountRequired,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (nom: string, montant: number) => void;
  title: string;
  hint: string;
  amountRequired: boolean;
}) {
  const [nom, setNom] = useState("");
  const [montant, setMontant] = useState(0);
  const valid = nom.trim().length > 0 && (!amountRequired || montant > 0);
  const submit = () => {
    if (!valid) return;
    onAdd(nom.trim(), montant);
    setNom("");
    setMontant(0);
  };
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="text-lg font-extrabold">{title}</h2>
      <p className="text-xs text-muted-foreground mt-1 mb-4">{hint}</p>
      <label htmlFor="add-line-name" className="text-xs font-bold text-muted-foreground">Nom</label>
      <div className="flex items-center gap-3 mt-1.5 mb-4">
        <CategoryTile name={nom || "?"} />
        <Input id="add-line-name" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Nounou" autoFocus maxLength={40} />
      </div>
      <label className="text-xs font-bold text-muted-foreground">Montant par mois</label>
      <MoneyInput value={montant} onChange={setMontant} className="mt-1.5 mb-5" />
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 h-11" onClick={onClose}>Annuler</Button>
        <Button className="flex-1 h-11 gradient-primary text-primary-foreground font-bold" disabled={!valid} onClick={submit}>
          Ajouter
        </Button>
      </div>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Étape 1 : le revenu                                                 */
/* ------------------------------------------------------------------ */

export function IncomeStep({
  revenu, onChange, onNext, onCancel,
}: {
  revenu: number;
  onChange: (n: number) => void;
  onNext: () => void;
  onCancel?: () => void;
}) {
  return (
    <Screen>
      <Screen.Content>
        <div className="max-w-md mx-auto">
          <StepHeader
            step={1}
            onCancel={onCancel}
            title="Combien tu gagnes par mois ?"
            subtitle="Salaire, business, aide… tout ce qui rentre. Un seul chiffre."
          />

          <div
            className="mt-6 rounded-3xl p-5 border border-primary/25"
            style={{ background: "linear-gradient(150deg, hsl(var(--primary) / 0.14), hsl(var(--card)) 70%)" }}
          >
            <div className="flex items-center gap-2 text-primary">
              <Wallet className="w-5 h-5" />
              <span className="text-xs font-extrabold uppercase tracking-[0.1em]">Mon revenu du mois</span>
            </div>
            <label htmlFor="budget-income" className="sr-only">Revenu mensuel en francs CFA</label>
            <MoneyInput
              id="budget-income"
              value={revenu}
              onChange={onChange}
              placeholder="0"
              showCurrency={false}
              className="mt-3 [&>input]:h-16 [&>input]:text-4xl [&>input]:font-extrabold [&>input]:tabular-nums [&>input]:bg-transparent [&>input]:border-none [&>input]:px-0 [&>input]:shadow-none [&>input]:focus-visible:ring-0"
            />
            <p className="text-sm font-bold text-muted-foreground -mt-1">FCFA par mois</p>
          </div>

          <p className="text-xs font-bold text-muted-foreground mt-6 mb-2.5">Ou touche un montant</p>
          <div className="grid grid-cols-3 gap-2">
            {INCOME_CHOICES.map((v) => {
              const on = revenu === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange(v)}
                  aria-pressed={on}
                  className={`h-12 rounded-2xl text-sm font-bold tabular-nums border transition-colors ${
                    on ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {fmt(v)}
                </button>
              );
            })}
          </div>
        </div>
      </Screen.Content>
      <Screen.StickyAction>
        <div className="max-w-md mx-auto">
          <Button className="w-full h-12 gradient-primary text-primary-foreground font-bold text-base" disabled={revenu <= 0} onClick={onNext}>
            Continuer
          </Button>
        </div>
      </Screen.StickyAction>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Étape 2 : les dépenses fixes                                        */
/* ------------------------------------------------------------------ */

export function FixedStep({
  revenu, fixed, onChange, onBack, onGenerate, generating, onCancel,
}: {
  revenu: number;
  fixed: FixedCharge[];
  onChange: (list: FixedCharge[]) => void;
  onBack: () => void;
  onGenerate: () => void;
  generating: boolean;
  onCancel?: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const isPreset = (nom: string) => FIXED_PRESETS.some((p) => p.nom === nom);
  const custom = fixed.filter((f) => !isPreset(f.nom));
  const fixedTotal = fixed.reduce((s, f) => s + (f.montant || 0), 0);
  const reste = revenu - fixedTotal;
  const missing = fixed.find((f) => !(f.montant > 0));

  const toggle = (nom: string) => {
    if (fixed.some((f) => f.nom === nom)) onChange(fixed.filter((f) => f.nom !== nom));
    else onChange([...fixed, { nom, montant: 0 }]);
  };
  const setAmount = (nom: string, montant: number) =>
    onChange(fixed.map((f) => (f.nom === nom ? { ...f, montant } : f)));

  if (generating) return <GeneratingView />;

  return (
    <Screen>
      <Screen.Content>
        <div className="max-w-md mx-auto">
          <StepHeader
            step={2}
            onBack={onBack}
            onCancel={onCancel}
            title="Tes dépenses fixes"
            subtitle="Ce que tu paies chaque mois, quoi qu'il arrive. Touche et mets le montant."
          />

          <div className="grid grid-cols-2 gap-2.5 mt-5">
            {FIXED_PRESETS.map((p) => {
              const item = fixed.find((f) => f.nom === p.nom);
              const on = !!item;
              const { color } = categoryStyle(p.nom);
              return (
                <div
                  key={p.key}
                  className={`relative rounded-2xl border p-3 transition-colors ${on ? "" : "border-border bg-card"}`}
                  style={on ? { borderColor: color, background: withAlpha(color, 0.1) } : undefined}
                >
                  <button type="button" onClick={() => toggle(p.nom)} aria-pressed={on} className="w-full text-left">
                    {on && (
                      <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: color }}>
                        <Check className="w-3 h-3 text-black" strokeWidth={3.5} />
                      </span>
                    )}
                    <CategoryTile name={p.nom} size={36} />
                    <p className="text-sm font-bold mt-2">{p.nom}</p>
                    {!on && <p className="text-[11px] text-muted-foreground mt-0.5">{p.hint}</p>}
                  </button>
                  {on && (
                    <MoneyInput
                      value={item.montant}
                      onChange={(n) => setAmount(p.nom, n)}
                      placeholder="Montant ?"
                      autoFocus={item.montant === 0}
                      className="mt-2 [&>input]:h-9 [&>input]:text-sm [&>input]:font-bold [&>input]:tabular-nums [&>input]:bg-background/60"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {custom.map((c) => (
            <div key={c.nom} className="flex items-center gap-3 mt-2.5 rounded-2xl border border-border bg-card p-3">
              <CategoryTile name={c.nom} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{c.nom}</p>
                <p className="text-xs font-semibold text-muted-foreground tabular-nums">{fmt(c.montant)} F</p>
              </div>
              <button type="button" onClick={() => toggle(c.nom)} aria-label={`Retirer ${c.nom}`} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full mt-2.5 h-12 rounded-2xl border border-dashed border-border text-primary text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-primary/5"
          >
            <Plus className="w-4 h-4" /> Autre dépense fixe
          </button>

          {/* Ce qui reste pour le mois */}
          <div className="mt-5 rounded-2xl border border-border bg-card p-4">
            <div className="flex h-3 rounded-full overflow-hidden bg-secondary" aria-hidden="true">
              {revenu > 0 && fixedTotal > 0 && (
                <div className="h-full bg-[hsl(28,90%,55%)]" style={{ width: `${Math.min(100, (fixedTotal / revenu) * 100)}%` }} />
              )}
              {reste > 0 && <div className="h-full bg-primary" style={{ width: `${(reste / revenu) * 100}%` }} />}
            </div>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Revenu</span>
                <span className="font-bold tabular-nums">{fmt(revenu)} F</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[hsl(28,90%,55%)]" /> Dépenses fixes
                </span>
                <span className="font-bold tabular-nums">−{fmt(fixedTotal)} F</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-border">
                <span className="font-bold flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${reste >= 0 ? "bg-primary" : "bg-destructive"}`} /> À répartir
                </span>
                <span className={`font-extrabold tabular-nums ${reste >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(reste)} F</span>
              </div>
            </div>
            {reste < 0 && (
              <p className="mt-3 flex items-start gap-2 text-xs text-destructive">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Tes dépenses fixes dépassent ton revenu. On va quand même faire ton budget.
              </p>
            )}
          </div>
        </div>
      </Screen.Content>
      <Screen.StickyAction>
        <div className="max-w-md mx-auto">
          <Button
            className="w-full h-12 gradient-primary text-primary-foreground font-bold text-base"
            disabled={!!missing}
            onClick={onGenerate}
          >
            {missing ? (
              <>Indique le montant : {missing.nom}</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> {fixed.length ? "Créer mon budget" : "Je n'en ai pas, continuer"}</>
            )}
          </Button>
        </div>
      </Screen.StickyAction>

      <AddLineSheet
        open={adding}
        onClose={() => setAdding(false)}
        amountRequired
        title="Une autre dépense fixe ?"
        hint="Nounou, gardien, abonnement, crédit moto…"
        onAdd={(nom, montant) => {
          if (!fixed.some((f) => f.nom.toLowerCase() === nom.toLowerCase())) onChange([...fixed, { nom, montant }]);
          setAdding(false);
        }}
      />
    </Screen>
  );
}

export function GeneratingView() {
  return (
    <div className="max-w-md mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center" role="status" aria-live="polite">
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.4, repeat: Infinity }}
        className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center neon-glow"
      >
        <Sparkles className="w-9 h-9 text-primary-foreground" />
      </motion.div>
      <p className="text-xl font-extrabold mt-6">Je prépare ton budget…</p>
      <p className="text-sm text-muted-foreground mt-1.5">Ça prend quelques secondes.</p>
      <div className="flex gap-1.5 mt-6" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-primary"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Étape 3 : le plan                                                   */
/* ------------------------------------------------------------------ */

function PlanRow({
  line, total, onChange, onRemove,
}: {
  line: PlanLine;
  total: number;
  onChange: (montant: number) => void;
  onRemove?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const step = stepFor(line.montant);
  const pct = total > 0 ? Math.round((line.montant / total) * 100) : 0;
  return (
    <motion.div layout className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <CategoryTile name={line.nom} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold truncate">{line.nom}</p>
            {line.fixed && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground bg-secondary rounded-full px-1.5 py-0.5">
                <Lock className="w-2.5 h-2.5" /> Fixe
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground tabular-nums">{pct} % du mois</p>
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={`Retirer ${line.nom}`} className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center hover:bg-secondary">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, line.montant - step))}
          aria-label={`Baisser ${line.nom} de ${fmt(step)} F`}
          className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center active:scale-95 transition-transform"
        >
          <Minus className="w-4 h-4" />
        </button>
        {editing ? (
          <MoneyInput
            value={line.montant}
            onChange={onChange}
            autoFocus
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditing(false); }}
            className="flex-1 [&>input]:h-11 [&>input]:text-center [&>input]:text-lg [&>input]:font-extrabold [&>input]:tabular-nums"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Modifier le montant de ${line.nom}`}
            className="flex-1 h-11 rounded-xl border border-border text-lg font-extrabold tabular-nums hover:border-primary/60 transition-colors"
          >
            {fmt(line.montant)} <span className="text-sm text-muted-foreground font-bold">F</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onChange(line.montant + step)}
          aria-label={`Augmenter ${line.nom} de ${fmt(step)} F`}
          className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

export function PlanStep({
  month, total, lines, advice, onChange, onBalance, onBack, onRestart, onActivate, activating, onCancel,
}: {
  month: number;
  total: number;
  lines: PlanLine[];
  advice?: string;
  onChange: (lines: PlanLine[]) => void;
  onBalance: () => void;
  onBack: () => void;
  onRestart: () => void;
  onActivate: () => void;
  activating: boolean;
  onCancel?: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const sum = planTotal(lines);
  const diff = total - sum;
  // Un dépassement, même petit, bloque l'activation ; un reste va dans Épargne.
  const balanced = diff === 0;
  const over = diff < 0;

  const update = (key: string, montant: number) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, montant, touched: true } : l)));
  const remove = (key: string) => onChange(lines.filter((l) => l.key !== key));

  return (
    <Screen>
      <Screen.Content>
        <div className="max-w-md mx-auto">
          <StepHeader
            step={3}
            onBack={onBack}
            onCancel={onCancel}
            title={`Ton budget de ${MONTHS[month - 1]}`}
            subtitle="Ajuste avec − et +, ou touche un montant pour l'écrire."
          />

          {advice && (
            <div className="mt-4 flex gap-2.5 items-start rounded-2xl border border-primary/20 bg-primary/5 p-3">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{advice}</p>
            </div>
          )}

          {/* Répartition visuelle */}
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold text-muted-foreground">Mon mois</span>
              <span className="text-lg font-extrabold tabular-nums">{fmt(total)} F</span>
            </div>
            <div className="flex h-3.5 rounded-full overflow-hidden bg-secondary mt-2.5" aria-hidden="true">
              {lines.map((l) => (
                <div
                  key={l.key}
                  className="h-full transition-all duration-300"
                  style={{ width: `${total > 0 ? Math.min(100, (l.montant / Math.max(total, sum)) * 100) : 0}%`, background: categoryStyle(l.nom).color }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1 ${
                  balanced ? "bg-primary/15 text-primary" : over ? "bg-destructive/15 text-destructive" : "bg-accent/15 text-accent"
                }`}
              >
                {balanced ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Tout est réparti</>
                ) : over ? (
                  <><AlertTriangle className="w-3.5 h-3.5" /> Trop de {fmt(-diff)} F</>
                ) : (
                  <><Wallet className="w-3.5 h-3.5" /> Reste {fmt(diff)} F</>
                )}
              </span>
              {!balanced && (
                <button
                  type="button"
                  onClick={onBalance}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border text-xs font-bold hover:border-primary/60"
                >
                  <Scale className="w-3.5 h-3.5" /> Équilibrer
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2.5 mt-4">
            {lines.map((l) => (
              <PlanRow
                key={l.key}
                line={l}
                total={total}
                onChange={(n) => update(l.key, n)}
                onRemove={l.fixed ? undefined : () => remove(l.key)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full mt-2.5 h-12 rounded-2xl border border-dashed border-border text-primary text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-primary/5"
          >
            <Plus className="w-4 h-4" /> Ajouter une ligne
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full mt-3 h-10 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Recommencer depuis le début
          </button>
        </div>
      </Screen.Content>
      <Screen.StickyAction>
        <div className="max-w-md mx-auto">
          <Button
            className="w-full h-12 gradient-primary text-primary-foreground font-bold text-base"
            disabled={over || activating || lines.length === 0}
            onClick={onActivate}
          >
            {activating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Activation…</>
            ) : over ? (
              <>Enlève {fmt(-diff)} F ou touche Équilibrer</>
            ) : (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> Activer mon budget</>
            )}
          </Button>
          {!balanced && !over && (
            <p className="text-center text-[11px] text-muted-foreground mt-1.5">
              Les {fmt(diff)} F non répartis iront dans Épargne.
            </p>
          )}
        </div>
      </Screen.StickyAction>

      <AddLineSheet
        open={adding}
        onClose={() => setAdding(false)}
        amountRequired={false}
        title="Ajouter une ligne"
        hint="Santé, vêtements, fêtes, business…"
        onAdd={(nom, montant) => {
          onChange([
            ...lines,
            { key: `u-${Date.now()}`, nom, montant, fixed: false, touched: true, original: 0 },
          ]);
          setAdding(false);
        }}
      />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Fin : budget activé                                                 */
/* ------------------------------------------------------------------ */

export function DoneStep({
  month, year, total, lines, onFinish,
}: {
  month: number;
  year: number;
  total: number;
  lines: PlanLine[];
  onFinish: () => void;
}) {
  // Moyenne sur tout le mois : diviser par les jours restants donnerait un
  // chiffre énorme pour un budget créé en fin de mois.
  const daysInMonth = new Date(year, month, 0).getDate();
  const everyday = lines.filter((l) => !l.fixed && !/epargne|épargne/i.test(l.nom)).reduce((s, l) => s + l.montant, 0);
  const perDay = Math.floor(everyday / daysInMonth);

  return (
    <Screen>
      <Screen.Content>
        <div className="max-w-md mx-auto text-center pt-8">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="w-24 h-24 mx-auto rounded-full gradient-primary flex items-center justify-center neon-glow"
          >
            <PartyPopper className="w-11 h-11 text-primary-foreground" />
          </motion.div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] mt-6">Ton budget est prêt !</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {fmt(total)} F répartis sur {lines.length} poste{lines.length > 1 ? "s" : ""}.
          </p>

          {perDay > 0 && (
            <div className="mt-6 rounded-3xl border border-primary/25 p-5" style={{ background: "linear-gradient(150deg, hsl(var(--primary) / 0.14), hsl(var(--card)) 70%)" }}>
              <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-primary">Chaque jour</p>
              <p className="text-4xl font-extrabold tabular-nums mt-1">{fmt(perDay)} F</p>
              <p className="text-xs text-muted-foreground mt-1">
                en moyenne pour tes dépenses du quotidien.
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-4 gap-2" aria-hidden="true">
            {lines.slice(0, 8).map((l) => (
              <div key={l.key} className="flex flex-col items-center gap-1">
                <CategoryTile name={l.nom} size={44} />
                <span className="text-[10px] text-muted-foreground truncate max-w-full">{l.nom}</span>
              </div>
            ))}
          </div>
        </div>
      </Screen.Content>
      <Screen.StickyAction>
        <div className="max-w-md mx-auto">
          <Button className="w-full h-12 gradient-primary text-primary-foreground font-bold text-base" onClick={onFinish}>
            Voir mon budget
          </Button>
        </div>
      </Screen.StickyAction>
    </Screen>
  );
}
