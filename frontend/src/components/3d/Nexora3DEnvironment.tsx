import { useLocation } from "react-router-dom";
import { FoldingParticleShell } from "./FoldingParticleShell";

export interface Nexora3DEnvironmentProps {
  /** Override opacity */
  opacity?: number;
  /** Force specific route variant */
  variant?: "landing" | "workspace" | "command";
}

export function Nexora3DEnvironment({ opacity, variant }: Nexora3DEnvironmentProps) {
  const { pathname } = useLocation();

  const isLanding = variant ? variant === "landing" : pathname === "/";
  const isCommand = variant ? variant === "command" : pathname.includes("/command");

  // Determine atmospheric tuning
  const effectiveOpacity = opacity !== undefined
    ? opacity
    : isLanding
      ? 0.72
      : isCommand
        ? 0.45
        : 0.35;

  const particleCount = isLanding ? 3400 : 2600;
  const foldSpeed = isLanding ? 0.75 : 0.6;
  const colorVariant = isLanding
    ? "obsidian-violet"
    : isCommand
      ? "electric-cyan"
      : "obsidian-violet";

  return (
    <div
      className="nexora-3d-environment"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <FoldingParticleShell
        particleCount={particleCount}
        shellRadius={isLanding ? 2.6 : 2.3}
        foldSpeed={foldSpeed}
        opacity={effectiveOpacity}
        interactive={true}
        colorVariant={colorVariant}
      />
      {/* Subtle depth vignette enhancing obsidian atmosphere */}
      <div
        className="nexora-vignette"
        style={{
          position: "absolute",
          inset: 0,
          background: isLanding
            ? "radial-gradient(circle at 50% 40%, transparent 40%, rgba(9, 10, 24, 0.65) 100%)"
            : "radial-gradient(circle at 50% 30%, transparent 35%, rgba(9, 10, 24, 0.75) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default Nexora3DEnvironment;
