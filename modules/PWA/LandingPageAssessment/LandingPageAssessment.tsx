"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { FiArrowUpRight, FiBookOpen, FiCheckSquare, FiUsers } from "react-icons/fi";
import InstallPWAButton from "@/components/Common/Buttons/InstallPWAButton";
import ParentLogin from "../ParentLogin/ParentLogin";
import StudentQuizAccess from "../StudentQuizAccess/StudentQuizAccess";

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

export default function LandingPageAssessment() {
  const [selectedPortal, setSelectedPortal] = useState<"home" | "parent" | "student">("home");
  const [isStandalone, setIsStandalone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
    <div className="relative min-h-dvh w-full overflow-x-hidden overflow-y-auto px-4 py-6 text-[#013300] sm:py-8 md:flex md:items-center md:justify-center">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(209,255,222,0.45),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(188,240,214,0.35),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,249,245,0.95))]" />
      <div className="pointer-events-none absolute left-[10%] right-[50%] top-32 -z-10 h-56 rounded-3xl bg-linear-to-br from-green-200/50 via-white/40 to-transparent blur-4xl" />
      <div className="pointer-events-none absolute left-[55%] right-[10%] bottom-16 -z-10 h-56 rounded-[40px] bg-linear-to-t from-green-200/60 via-white/35 to-transparent blur-4xl" />

      <motion.div
        initial={mounted ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto w-full max-w-4xl"
      >
        {!isStandalone ? (
          <div className="w-full space-y-5 rounded-3xl border-4 border-[#013300] bg-white/85 p-5 shadow-xl backdrop-blur-sm sm:p-8 sm:space-y-6">
            <div className="flex flex-col items-center">
              <Image
                src="/RPT-SAES/RPTLogo.png"
                alt="RPT-SAES Logo"
                width={72}
                height={72}
                className="h-16 w-16 object-contain drop-shadow-md"
              />
              <h1 className="text-3xl font-bold bg-linear-to-r from-green-800 to-[#013300] bg-clip-text text-transparent mt-3">
                RPT Portal
              </h1>
              <p className="text-[#013300]/70 font-medium mt-1">Parent and Student PWA</p>
            </div>

            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#013300]/50">Before You Install</p>
              <h2 className="text-2xl font-bold text-[#013300] mt-2">Install the School Portal</h2>
              <p className="text-sm text-[#013300]/60 mt-2">
                Install the app so parents can sign in from the same shortcut students use to open the quiz.
              </p>
            </div>

            <div className="rounded-2xl border border-green-100/80 bg-white/70 p-4 space-y-3 text-sm text-[#013300]/80">
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
          <div className="relative w-full overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,247,0.98))] p-5 shadow-[0_24px_80px_rgba(1,51,0,0.08)] sm:rounded-[40px] sm:p-8 md:p-10">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-20 top-10 h-52 w-52 rounded-full bg-[#dcefe1] blur-3xl" />
              <div className="absolute right-[-4rem] top-[-2rem] h-56 w-56 rounded-full bg-[#eff5d9] blur-3xl" />
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#013300]/10 to-transparent" />
            </div>

            <div className="relative flex flex-col items-center text-center">
              <div className="mb-4 rounded-full border border-[#013300]/10 bg-white/80 px-4 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#013300]/55">
                RPT-SAES
              </div>
              <Image
                src="/RPT-SAES/RPTLogo.png"
                alt="RPT-SAES Logo"
                width={72}
                height={72}
                className="h-16 w-16 object-contain drop-shadow-md"
              />
              <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.05em] text-[#013300] sm:text-[3rem] md:text-[3.6rem]">
                RPT Portal
              </h1>
              <p className="mt-3 text-sm font-medium text-[#013300]/55 sm:text-base md:text-lg">Choose your space</p>
            </div>

            <div className="relative mt-10 grid gap-5 md:grid-cols-2">
              <button
                type="button"
                onClick={() => openPortal("parent")}
                className="group relative overflow-hidden rounded-[28px] border border-[#0d6039]/10 bg-[#0d6039] p-6 text-left text-white transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(13,96,57,0.18)] sm:rounded-[32px] sm:p-8"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/8" />
                <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-black/8 to-transparent" />
                <div className="relative flex min-h-[240px] flex-col sm:min-h-[280px]">
                  <div className="flex items-center justify-center transition group-hover:scale-[1.02]">
                    <ParentPortalBadge />
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-4">
                    <h2 className="max-w-[11ch] text-[2rem] font-semibold leading-[0.95] tracking-[-0.05em] sm:text-[2.35rem]">
                      Enter as Parent
                    </h2>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white/90 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                      <FiArrowUpRight className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openPortal("student")}
                className="group relative overflow-hidden rounded-[28px] border border-[#013300]/10 bg-[linear-gradient(180deg,#f8fbf4_0%,#eef5e8_100%)] p-6 text-left text-[#013300] transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(1,51,0,0.10)] sm:rounded-[32px] sm:p-8"
              >
                <div className="pointer-events-none absolute right-6 top-6 h-24 w-24 rounded-full bg-white/60 blur-2xl" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#dfead6]/50 to-transparent" />
                <div className="relative flex min-h-[240px] flex-col sm:min-h-[280px]">
                  <div className="flex items-center justify-center transition group-hover:scale-[1.02]">
                    <StudentQuizBadge />
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-4">
                    <h2 className="max-w-[10ch] text-[2rem] font-semibold leading-[0.95] tracking-[-0.05em] text-[#013300] sm:text-[2.35rem]">
                      Enter RPT Quiz
                    </h2>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#013300]/10 bg-white text-[#013300] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
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
