import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  BABY_NAME_MAX_LENGTH,
  BABY_NAME_SUGGESTIONS,
  agree,
  cleanBabyName,
  validateBabyName,
  type BabyVariant,
} from "@/lib/baby";
import { BabyAvatar } from "./BabyAvatar";
import { invalidateBabyStatus, patchBabyStatus } from "./useBabyStatus";
import { celebrateAdoption } from "./celebrations";

const CHOICES: { variant: BabyVariant; label: string }[] = [
  { variant: "girl", label: "Une fille" },
  { variant: "boy", label: "Un garçon" },
];

/** Prénoms suggérés : ceux qui vont au genre choisi d'abord. */
const GIRL_NAMES = new Set(["Awa", "Ama"]);
const orderedSuggestions = (variant: BabyVariant | null) =>
  [...BABY_NAME_SUGGESTIONS].sort((a, b) => {
    if (!variant) return 0;
    const score = (n: string) => (GIRL_NAMES.has(n) === (variant === "girl") ? 0 : 1);
    return score(a) - score(b);
  });

export interface AdoptBabySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

/** Adoption : fille ou garçon, puis un prénom. */
export default function AdoptBabySheet({ open, onOpenChange, userId }: AdoptBabySheetProps) {
  const queryClient = useQueryClient();
  const [variant, setVariant] = useState<BabyVariant | null>(null);
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const ids = useId();
  const nameId = `${ids}-name`;
  const hintId = `${ids}-hint`;
  const errorId = `${ids}-error`;

  useEffect(() => {
    if (!open) {
      setSubmitted(false);
      setError(null);
    }
  }, [open]);

  const clean = cleanBabyName(name);
  const nameError = validateBabyName(name);
  const showNameError = submitted && !!nameError;
  const variantError = submitted && !variant ? "Choisis d'abord une fille ou un garçon." : null;
  const count = [...clean].length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (!variant) return;
    if (nameError) {
      input.current?.focus();
      return;
    }
    setBusy(true);
    const { data, error: insertError } = await supabase
      .from("baby_companions")
      .insert({ user_id: userId, name: clean, variant })
      .select("born_at")
      .maybeSingle();
    if (insertError) {
      setBusy(false);
      // Déjà un bébé (autre appareil, double clic) : on affiche simplement le sien.
      if (insertError.code === "23505") {
        await invalidateBabyStatus(queryClient);
        onOpenChange(false);
        return;
      }
      setError(
        insertError.code === "23514"
          ? "Ce prénom n'est pas accepté. Essaie un prénom plus court."
          : "L'adoption n'a pas abouti. Vérifie ta connexion et réessaie.",
      );
      return;
    }
    const bornAt = data?.born_at ?? new Date().toISOString();
    setBusy(false);
    onOpenChange(false);
    patchBabyStatus(queryClient, userId, {
      name: clean,
      variant,
      bornAt,
      notificationsEnabled: true,
      fedDays: 0,
      lastFedAt: bornAt,
    });
    void invalidateBabyStatus(queryClient);
    celebrateAdoption(clean, variant);
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DrawerContent className="max-h-[92dvh] border-border bg-card">
        <form onSubmit={submit} noValidate className="mx-auto w-full max-w-md overflow-y-auto px-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
          <DrawerHeader className="px-0 pb-3 text-left">
            <DrawerTitle className="text-xl font-extrabold">Adopte ton bébé Jeton</DrawerTitle>
            <DrawerDescription className="text-sm leading-relaxed">
              Chaque jour où tu notes une dépense, tu le nourris et il grandit. Si tu l'oublies, son biberon se vide 🍼
            </DrawerDescription>
          </DrawerHeader>

          <fieldset>
            <legend className="mb-2 text-sm font-bold text-foreground">Fille ou garçon ?</legend>
            <div className="grid grid-cols-2 gap-3">
              {CHOICES.map((choice) => {
                const selected = variant === choice.variant;
                return (
                  <button
                    key={choice.variant}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setVariant(choice.variant)}
                    className={cn(
                      "relative flex flex-col items-center rounded-2xl border-2 px-2 pb-3 pt-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      selected ? "border-primary bg-primary/10" : "border-border bg-background/40 hover:border-primary/50",
                    )}
                  >
                    {selected && (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                      </span>
                    )}
                    <BabyAvatar
                      variant={choice.variant}
                      age="newborn"
                      mood="happy"
                      size={112}
                      alt=""
                      cues={false}
                      animated={selected}
                    />
                    <span className="mt-1 text-sm font-extrabold text-foreground">{choice.label}</span>
                  </button>
                );
              })}
            </div>
            {variantError && (
              <p role="alert" className="mt-2 text-xs font-semibold text-destructive">
                {variantError}
              </p>
            )}
          </fieldset>

          <div className="mt-5">
            <label htmlFor={nameId} className="text-sm font-bold text-foreground">
              {variant ? `Comment s'appelle-t-${agree(variant, "il", "elle")} ?` : "Son prénom"}
            </label>
            <div className="relative mt-2">
              <Input
                id={nameId}
                ref={input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={BABY_NAME_MAX_LENGTH + 8}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="done"
                placeholder="Ex. : Kofi"
                aria-invalid={showNameError}
                aria-describedby={showNameError ? `${errorId} ${hintId}` : hintId}
                className="h-12 rounded-xl pr-14 text-base"
              />
              <span
                id={hintId}
                className={cn(
                  "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums",
                  count > BABY_NAME_MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
                )}
              >
                <span className="sr-only">Longueur : </span>
                {count}/{BABY_NAME_MAX_LENGTH}
              </span>
            </div>
            {showNameError && (
              <p id={errorId} role="alert" className="mt-1.5 text-xs font-semibold text-destructive">
                {nameError}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Idées de prénoms">
              <span className="text-xs text-muted-foreground">Idées :</span>
              {orderedSuggestions(variant).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  aria-pressed={clean === suggestion}
                  onClick={() => setName(suggestion)}
                  className={cn(
                    "h-11 min-w-[44px] rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    clean === suggestion
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-background/40 text-foreground hover:border-primary/50",
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="bg-primary mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-extrabold text-primary-foreground shadow-sm transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-70"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Un instant…
              </>
            ) : (
              <span className="truncate">{clean && !nameError ? `Adopter ${clean}` : "Adopter mon bébé"}</span>
            )}
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">Tu pourras changer son prénom plus tard.</p>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
