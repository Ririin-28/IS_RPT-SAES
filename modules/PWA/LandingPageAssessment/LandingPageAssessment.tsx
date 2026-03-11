"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowUpRight, FiBookOpen, FiCheckSquare, FiUsers } from "react-icons/fi";
import InstallPWAButton from "@/components/Common/Buttons/InstallPWAButton";
import ParentLogin from "../ParentLogin/ParentLogin";
import StudentQuizAccess from "../StudentQuizAccess/StudentQuizAccess";

type AnimatedLogoMode = "main" | "parent" | "quiz";

const LOGO_THEMES: Record<
  AnimatedLogoMode,
  {
    accent: string;
    glow: string;
    panel: string;
    beam: string;
    dotShadow: string;
    strip: string;
  }
> = {
  main: {
    accent: "#0d6039",
    glow: "radial-gradient(circle, rgba(34,197,94,0.34) 0%, rgba(34,197,94,0.06) 65%, transparent 100%)",
    panel: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(236,248,240,0.96))",
    beam: "linear-gradient(180deg, rgba(13,96,57,0.12), rgba(13,96,57,0.02))",
    dotShadow: "0 0 0 6px rgba(13,96,57,0.12)",
    strip: "linear-gradient(90deg, rgba(13,96,57,0), rgba(13,96,57,0.9), rgba(13,96,57,0))",
  },
  parent: {
    accent: "#f3c15e",
    glow: "radial-gradient(circle, rgba(13,96,57,0.36) 0%, rgba(243,193,94,0.14) 52%, transparent 100%)",
    panel: "linear-gradient(180deg, rgba(13,96,57,0.98), rgba(16,86,54,0.94))",
    beam: "linear-gradient(180deg, rgba(243,193,94,0.7), rgba(243,193,94,0.06))",
    dotShadow: "0 0 0 6px rgba(243,193,94,0.18)",
    strip: "linear-gradient(90deg, rgba(243,193,94,0), rgba(243,193,94,0.95), rgba(243,193,94,0))",
  },
  quiz: {
    accent: "#46a301",
    glow: "radial-gradient(circle, rgba(70,163,1,0.34) 0%, rgba(70,163,1,0.08) 60%, transparent 100%)",
    panel: "linear-gradient(180deg, rgba(238,245,232,0.98), rgba(225,241,212,0.94))",
    beam: "linear-gradient(180deg, rgba(70,163,1,0.5), rgba(70,163,1,0.04))",
    dotShadow: "0 0 0 6px rgba(70,163,1,0.16)",
    strip: "linear-gradient(90deg, rgba(70,163,1,0), rgba(70,163,1,0.95), rgba(70,163,1,0))",
  },
};

function ParentPortalBadge() {
  return (
    <div className="relative h-40 w-full max-w-[240px]" aria-hidden="true">
      <div className="absolute left-8 top-3 h-28 w-28 rounded-[32px] bg-white/12" />
      <div className="absolute right-8 top-0 h-24 w-24 rounded-full bg-white/8" />
      <div className="absolute left-6 top-7 flex h-28 w-28 items-center justify-center rounded-[32px] border border-white/12 bg-white/10 backdrop-blur-sm shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
        <FiUsers className="h-14 w-14 text-white" strokeWidth={2.1} />
      </div>
      <div className="absolute right-10 top-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/12 bg-[#f3c15e] text-[#11452c] shadow-[0_14px_30px_rgba(0,0,0,0.12)]">
        <FiBookOpen className="h-7 w-7" strokeWidth={2.2} />
      </div>
      <div className="absolute bottom-5 left-12 h-3 w-24 rounded-full bg-white/10" />
      <div className="absolute bottom-2 right-8 flex h-14 w-14 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white/90">
        <FiCheckSquare className="h-6 w-6" strokeWidth={2.2} />
      </div>
    </div>
  );
}

function StudentQuizBadge() {
  return (
    <div className="relative h-40 w-full max-w-[240px]" aria-hidden="true">
      <div className="absolute left-6 top-4 h-28 w-28 rounded-[30px] bg-white/60" />
      <div className="absolute right-10 top-5 h-20 w-20 rounded-[26px] bg-[#dfeac7]" />
      <div className="absolute left-8 top-7 flex h-28 w-28 items-center justify-center rounded-[30px] border border-[#013300]/8 bg-white shadow-[0_18px_40px_rgba(1,51,0,0.06)]">
        <FiBookOpen className="h-14 w-14 text-[#013300]" strokeWidth={2.1} />
      </div>
      <div className="absolute right-11 top-[4.25rem] flex h-16 w-16 items-center justify-center rounded-2xl border border-[#013300]/8 bg-[#e7f1d7] text-[#4d7f2d] shadow-[0_12px_26px_rgba(1,51,0,0.08)]">
        <FiCheckSquare className="h-7 w-7" strokeWidth={2.2} />
      </div>
      <div className="absolute bottom-6 left-10 flex h-14 w-14 items-center justify-center rounded-full bg-[#013300] text-white shadow-[0_14px_28px_rgba(1,51,0,0.16)]">
        <FiBookOpen className="h-6 w-6" strokeWidth={2.1} />
      </div>
      <div className="absolute bottom-8 left-28 h-3 w-24 rounded-full bg-[#013300]/8" />
    </div>
  );
}

function AnimatedPortalLogo({ mode }: { mode: AnimatedLogoMode }) {
  const theme = LOGO_THEMES[mode];

  return (
    <motion.div
      className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-[#013300]/10 bg-white shadow-[0_16px_36px_rgba(1,51,0,0.12)] sm:h-[4.5rem] sm:w-[4.5rem]"
      aria-hidden="true"
      animate={{ y: [0, -2, 0], rotate: [0, 1.5, 0, -1.5, 0] }}
      transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.div
        className="pointer-events-none absolute -inset-5 rounded-full blur-2xl"
        style={{ background: theme.glow }}
        animate={{ opacity: [0.35, 0.7, 0.45], scale: [0.8, 1.08, 0.9] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      >
        <span
          className="absolute left-1/2 top-[6px] h-2.5 w-2.5 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: theme.accent, boxShadow: theme.dotShadow }}
        />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-60"
        animate={{ rotate: [0, 180, 360] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: "linear" }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-[118%] w-5 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[18px]"
          style={{ background: theme.beam }}
        />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-[5px] rounded-[18px] border border-white/60"
        style={{ background: theme.panel }}
        animate={{ scale: [1, 1.03, 1], opacity: [0.96, 1, 0.96] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, scale: 0.52, rotate: -18, y: 8, filter: "blur(6px)" }}
          animate={{ opacity: 1, scale: 1, rotate: 0, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 1.14, rotate: 18, y: -8, filter: "blur(6px)" }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 flex items-center justify-center"
        >
          {mode === "main" ? (
            <Image
              src="/RPT-SAES/RPTLogo.png"
              alt=""
              width={72}
              height={72}
              className="h-11 w-11 object-contain drop-shadow-md sm:h-12 sm:w-12"
            />
          ) : mode === "parent" ? (
            <div className="relative flex h-11 w-11 items-center justify-center rounded-[18px] bg-[#0d6039] text-white shadow-[0_12px_26px_rgba(13,96,57,0.24)] sm:h-12 sm:w-12">
              <FiUsers className="h-6 w-6" strokeWidth={2.3} />
              <motion.span
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#f3c15e] text-[#11452c]"
                animate={{ scale: [1, 1.18, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <FiCheckSquare className="h-2.5 w-2.5" strokeWidth={2.5} />
              </motion.span>
            </div>
          ) : (
            <div className="relative flex h-11 w-11 items-center justify-center rounded-[18px] bg-[#eef5e8] text-[#013300] shadow-[0_12px_26px_rgba(1,51,0,0.12)] sm:h-12 sm:w-12">
              <FiBookOpen className="h-6 w-6" strokeWidth={2.3} />
              <motion.span
                className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-[#46a301] ring-4 ring-white/80"
                animate={{ scale: [0.9, 1.2, 0.9], opacity: [0.85, 1, 0.85] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <motion.div
        className="pointer-events-none absolute bottom-[6px] left-1/2 z-10 h-1 rounded-full"
        style={{ background: theme.strip }}
        animate={{ width: [18, 30, 22], opacity: [0.45, 0.95, 0.55], x: "-50%" }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

export default function LandingPageAssessment() {
  const [selectedPortal, setSelectedPortal] = useState<"home" | "parent" | "student">("home");
  const [isStandalone, setIsStandalone] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [logoMode, setLogoMode] = useState<AnimatedLogoMode>("main");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const scheduleCycle = () => {
      setLogoMode("main");

      const timeouts = [
        window.setTimeout(() => setLogoMode("parent"), 7000),
        window.setTimeout(() => setLogoMode("quiz"), 8200),
        window.setTimeout(() => setLogoMode("main"), 9400),
      ];

      return () => {
        timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      };
    };

    let clearSequence = scheduleCycle();
    const intervalId = window.setInterval(() => {
      clearSequence();
      clearSequence = scheduleCycle();
    }, 10000);

    return () => {
      clearSequence();
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const evaluateStandalone = () => {
      const standaloneMatch = window.matchMedia("(display-mode: standalone)").matches;
      const fullscreenMatch = window.matchMedia("(display-mode: fullscreen)").matches;
      const minimalUiMatch = window.matchMedia("(display-mode: minimal-ui)").matches;
      const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
      setIsStandalone(standaloneMatch || fullscreenMatch || minimalUiMatch || iosStandalone);
    };

    evaluateStandalone();
    const media = window.matchMedia("(display-mode: standalone)");
    const handler = () => evaluateStandalone();

    try {
      media.addEventListener("change", handler);
    } catch {
      (media as MediaQueryList & { addListener?: (listener: () => void) => void }).addListener?.(handler);
    }

    window.addEventListener("appinstalled", evaluateStandalone);

    return () => {
      try {
        media.removeEventListener("change", handler);
      } catch {
        (media as MediaQueryList & { removeListener?: (listener: () => void) => void }).removeListener?.(handler);
      }
      window.removeEventListener("appinstalled", evaluateStandalone);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const portal = params.get("portal");
    const hasStudentDeepLink = params.has("code") || params.has("token");

    if (portal === "parent" || portal === "student") {
      setSelectedPortal(portal);
      return;
    }

    if (hasStudentDeepLink) {
      setSelectedPortal("student");
    }
  }, []);

  const updatePortalRoute = (portal: "home" | "parent" | "student") => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const token = url.searchParams.get("token");

    url.search = "";
    if (portal !== "home") {
      url.searchParams.set("portal", portal);
    }
    if (portal === "student" && code) {
      url.searchParams.set("code", code);
    }
    if (portal === "student" && token) {
      url.searchParams.set("token", token);
    }

    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const openPortal = (portal: "parent" | "student") => {
    setSelectedPortal(portal);
    updatePortalRoute(portal);
  };

  const goHome = () => {
    setSelectedPortal("home");
    updatePortalRoute("home");
  };

  if (selectedPortal === "student") {
    return <StudentQuizAccess onBack={goHome} />;
  }

  if (selectedPortal === "parent") {
    return <ParentLogin onBack={goHome} />;
  }

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden overflow-y-auto px-3 py-4 text-[#013300] sm:px-4 sm:py-6 lg:flex lg:items-center lg:justify-center">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(209,255,222,0.45),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(188,240,214,0.35),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,249,245,0.95))]" />
      <div className="pointer-events-none absolute left-[10%] right-[50%] top-32 -z-10 h-56 rounded-3xl bg-linear-to-br from-green-200/50 via-white/40 to-transparent blur-4xl" />
      <div className="pointer-events-none absolute left-[55%] right-[10%] bottom-16 -z-10 h-56 rounded-[40px] bg-linear-to-t from-green-200/60 via-white/35 to-transparent blur-4xl" />

      <motion.div
        initial={mounted ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto w-full max-w-[920px]"
      >
        {!isStandalone ? (
          <div className="mx-auto w-full max-w-2xl space-y-4 rounded-[28px] border-[3px] border-[#013300] bg-white/88 p-4 shadow-xl backdrop-blur-sm sm:space-y-5 sm:p-6 md:p-7">
            <div className="flex items-center justify-center gap-3 text-left sm:gap-4">
              <AnimatedPortalLogo mode={logoMode} />
              <div>
                <h1 className="text-[2rem] font-bold bg-linear-to-r from-green-800 to-[#013300] bg-clip-text text-transparent sm:text-[2.3rem]">
                  RPT Portal
                </h1>
                <p className="mt-1 text-sm font-medium text-[#013300]/70 sm:text-base">Parent and Student PWA</p>
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#013300]/50">Before You Install</p>
              <h2 className="mt-2 text-[1.7rem] font-bold text-[#013300] sm:text-2xl">Install the School Portal</h2>
              <p className="mt-2 text-sm leading-6 text-[#013300]/60">
                Install the app so parents can sign in from the same shortcut students use to open the quiz.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-green-100/80 bg-white/70 p-4 text-sm text-[#013300]/80">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-6 w-6 rounded-full bg-green-100 text-[#013300] flex items-center justify-center text-xs font-bold">1</span>
                <p>Tap the install button to add RPT Portal to your home screen.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-6 w-6 rounded-full bg-green-100 text-[#013300] flex items-center justify-center text-xs font-bold">2</span>
                <p>Open the app from your home screen after it installs.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-6 w-6 rounded-full bg-green-100 text-[#013300] flex items-center justify-center text-xs font-bold">3</span>
                <p>Choose Parent to sign in or Student to enter RPT Quiz.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <InstallPWAButton />
              <p className="text-xs text-center text-[#013300]/50">
                Already installed? Open the app and choose Parent or Student.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative w-full overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,247,0.98))] p-4 shadow-[0_24px_80px_rgba(1,51,0,0.08)] sm:rounded-[32px] sm:p-6 md:p-7">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-20 top-10 h-52 w-52 rounded-full bg-[#dcefe1] blur-3xl" />
              <div className="absolute right-[-4rem] top-[-2rem] h-56 w-56 rounded-full bg-[#eff5d9] blur-3xl" />
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#013300]/10 to-transparent" />
            </div>

            <div className="relative flex flex-col items-center text-center">
              <div className="flex items-center justify-center gap-3 text-left sm:gap-4">
                <AnimatedPortalLogo mode={logoMode} />
                <div>
                  <h1 className="text-[2.1rem] font-bold tracking-[-0.05em] text-[#013300] sm:text-[2.7rem] lg:text-[3.1rem]">
                    RPT Portal
                  </h1>
                  <p className="mt-1 text-sm font-medium text-[#013300]/55 sm:text-base">Choose your space</p>
                </div>
              </div>
            </div>

            <div className="relative mt-8 grid gap-4 lg:grid-cols-2">
              <button
                type="button"
                onClick={() => openPortal("parent")}
                className="group relative overflow-hidden rounded-[24px] border border-[#0d6039]/10 bg-[#0d6039] p-5 text-left text-white transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(13,96,57,0.18)] sm:rounded-[28px] sm:p-6"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/8" />
                <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-black/8 to-transparent" />
                <div className="relative flex min-h-[208px] flex-col sm:min-h-[232px]">
                  <div className="flex items-center justify-center transition group-hover:scale-[1.02]">
                    <ParentPortalBadge />
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-4">
                    <h2 className="max-w-[11ch] text-[1.8rem] font-semibold leading-[0.95] tracking-[-0.05em] sm:text-[2.15rem]">
                      Enter as Parent
                    </h2>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white/90 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:h-12 sm:w-12">
                      <FiArrowUpRight className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openPortal("student")}
                className="group relative overflow-hidden rounded-[24px] border border-[#013300]/10 bg-[linear-gradient(180deg,#f8fbf4_0%,#eef5e8_100%)] p-5 text-left text-[#013300] transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(1,51,0,0.10)] sm:rounded-[28px] sm:p-6"
              >
                <div className="pointer-events-none absolute right-6 top-6 h-24 w-24 rounded-full bg-white/60 blur-2xl" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#dfead6]/50 to-transparent" />
                <div className="relative flex min-h-[208px] flex-col sm:min-h-[232px]">
                  <div className="flex items-center justify-center transition group-hover:scale-[1.02]">
                    <StudentQuizBadge />
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-4">
                    <h2 className="max-w-[10ch] text-[1.8rem] font-semibold leading-[0.95] tracking-[-0.05em] text-[#013300] sm:text-[2.15rem]">
                      Enter RPT Quiz
                    </h2>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#013300]/10 bg-white text-[#013300] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:h-12 sm:w-12">
                      <FiArrowUpRight className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
