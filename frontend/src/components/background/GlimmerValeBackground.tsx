import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

type GlimmerValeBackgroundProps = {
  children: ReactNode;
  scene?: ReactNode;
};

function isCanvas(target: EventTarget | null): target is HTMLCanvasElement {
  return target instanceof HTMLCanvasElement;
}

export function GlimmerValeBackground({ children, scene }: GlimmerValeBackgroundProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [contextLost, setContextLost] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const root = sceneRef.current;
    if (!root || !scene) return;

    const onContextLost = (event: Event) => {
      if (!isCanvas(event.target)) return;
      event.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = (event: Event) => {
      if (isCanvas(event.target)) setContextLost(false);
    };
    root.addEventListener("webglcontextlost", onContextLost, true);
    root.addEventListener("webglcontextrestored", onContextRestored, true);
    return () => {
      root.removeEventListener("webglcontextlost", onContextLost, true);
      root.removeEventListener("webglcontextrestored", onContextRestored, true);
    };
  }, [scene]);

  const isLanding = pathname === "/";
  const backgroundClass = `app-atmosphere ${isLanding ? "atmosphere-landing" : "atmosphere-workspace"}`;

  return (
    <div className={backgroundClass}>
      {scene && !contextLost ? (
        <div ref={sceneRef} className="glimmervale-scene" aria-hidden="true">
          {scene}
        </div>
      ) : null}
      <div className="atmosphere-wash" aria-hidden="true" />
      <div className="atmosphere-content">{children}</div>
    </div>
  );
}
