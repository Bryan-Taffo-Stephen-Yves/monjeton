import { BabyAvatar } from "./BabyAvatar";
import "./babyWelcome.css";

/**
 * Décor du 4ᵉ écran de bienvenue : à la place d'une photo, un fond dégradé
 * doux et les deux bébés Jeton (fille et garçon), tout contents.
 * Utilisé dans .mj-entry (écrans d'entrée, toujours sombres).
 */
export default function BabyWelcomeStage() {
  return (
    <div className="baby-welcome-stage" role="img" aria-label="Deux bébés Jeton tout contents : une petite fille et un petit garçon.">
      <span className="baby-welcome-ring" aria-hidden="true" />
      <span className="baby-welcome-ring glow-2" aria-hidden="true" />
      <span className="baby-welcome-spark spark-1" aria-hidden="true" />
      <span className="baby-welcome-spark spark-2" aria-hidden="true" />
      <span className="baby-welcome-spark spark-3" aria-hidden="true" />
      <div className="baby-welcome-babies" aria-hidden="true">
        <BabyAvatar variant="girl" age="baby" mood="happy" size={196} alt="" priority className="baby-welcome-girl" />
        <BabyAvatar variant="boy" age="baby" mood="happy" size={196} alt="" priority className="baby-welcome-boy" />
      </div>
    </div>
  );
}
