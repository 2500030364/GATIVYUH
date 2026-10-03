import React, { useCallback, useEffect, useRef, useState } from "react";
import App from "../App";
import { LandingPage } from "./LandingPage";

type Page = "landing" | "app";
type Transition = "idle" | "entering" | "returning";

const pageFromPath = (): Page => window.location.pathname === "/app" ? "app" : "landing";

export const ExperienceRouter: React.FC = () => {
  const [page, setPage] = useState<Page>(pageFromPath);
  const [transition, setTransition] = useState<Transition>("idle");
  const pendingTimer = useRef<number | null>(null);

  useEffect(() => {
    const handleHistory = () => {
      if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
      setTransition("idle");
      setPage(pageFromPath());
    };
    window.addEventListener("popstate", handleHistory);
    return () => {
      window.removeEventListener("popstate", handleHistory);
      if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
    };
  }, []);

  const navigate = useCallback((target: Page) => {
    if (target === page || transition !== "idle") return;
    setTransition(target === "app" ? "entering" : "returning");
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 720;
    pendingTimer.current = window.setTimeout(() => {
      window.history.pushState({ gativyuhExperience: target }, "", target === "app" ? "/app" : "/");
      setPage(target);
      setTransition("idle");
      window.scrollTo({ top: 0, behavior: "instant" });
      pendingTimer.current = null;
    }, duration);
  }, [page, transition]);

  return (
    <div className={`experience-root experience-${page} transition-${transition}`}>
      {page === "landing"
        ? <LandingPage onEnter={() => navigate("app")} />
        : <App onReturnToLanding={() => navigate("landing")} />}
      {transition !== "idle" && <div className="experience-transition-route" aria-hidden="true"><span /><i /><b /></div>}
    </div>
  );
};
