import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import "./entry.css";

/** Éléments communs aux écrans d'entrée de l'application mobile. */

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "compact" : ""}`}>
      Mon Jeton
      <span className="brand-period" aria-hidden="true">
        .
      </span>
    </span>
  );
}

export function Primary({
  children,
  onClick,
  type = "button",
  busy = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "submit" | "button";
  busy?: boolean;
}) {
  return (
    <button type={type} className="primary" onClick={onClick} disabled={busy} aria-busy={busy}>
      {busy ? (
        <>
          <span className="spinner" />
          Un instant…
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function Back({ onClick, label = "Retour" }: { onClick: () => void; label?: string }) {
  return (
    <button className="icon-button back" type="button" onClick={onClick} aria-label={label}>
      <ArrowLeft size={21} />
    </button>
  );
}

/** Conteneur plein écran : fond sombre, zones sûres iOS / Android. */
export function EntryShell({ children, screen }: { children: ReactNode; screen: string }) {
  return (
    <div className="mj-entry">
      <div className="experience" data-screen={screen}>
        {children}
      </div>
    </div>
  );
}

export function EntryLoader() {
  return (
    <div className="mj-entry">
      <div className="experience entry-loading" aria-busy="true" aria-label="Chargement">
        <span className="spinner" />
      </div>
    </div>
  );
}
