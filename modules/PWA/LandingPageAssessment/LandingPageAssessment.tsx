"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import InstallPWAButton from "@/components/Common/Buttons/InstallPWAButton";
import RemedialAssessment from "../RemedialAssessment/RemedialAssessment";

export default function LandingPageAssessment() {
  const [quizCode, setQuizCode] = useState("");
  const [studentId, setStudentId] = useState("");
  const [isStandalone, setIsStandalone] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessment, setAssessment] = useState<any | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedSummary, setCompletedSummary] = useState<{
    score: number;
    correct: number;
    incorrect: number;
    total: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [studentLrn, setStudentLrn] = useState<string | null>(null);
  const quizCodeRef = useRef<HTMLInputElement | null>(null);
  const html5ScannerRef = useRef<any | null>(null);
  const html5CtorRef = useRef<any | null>(null);
  const scannerContainerId = "html5-qr-scanner";

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
    } catch (e) {
      (media as any).addListener(handler);
    }

    window.addEventListener("appinstalled", evaluateStandalone);

    return () => {
      try {
        media.removeEventListener("change", handler);
      } catch (e) {
        (media as any).removeListener(handler);
      }
      window.removeEventListener("appinstalled", evaluateStandalone);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    import("html5-qrcode")
      .then((mod: any) => {
        if (!isMounted) return;
        html5CtorRef.current = mod.Html5Qrcode ?? mod.default?.Html5Qrcode ?? mod.default;
      })
      .catch(() => null);
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const token = params.get("token");
    if (code) {
      setQuizCode(code.toUpperCase());
    }
    if (token) {
      setQrToken(token);
    }
  }, []);

  const stopScan = useCallback(() => {
    if (html5ScannerRef.current) {
      const scanner = html5ScannerRef.current;
      html5ScannerRef.current = null;
      Promise.resolve()
        .then(() => scanner.stop?.())
        .then(() => scanner.clear?.())
        .catch(() => null);
    }
    setIsScanning(false);
    setScanStatus(null);
  }, []);

  const applyScanValue = useCallback((value: string) => {
    if (!value) return;
    try {
      const url = new URL(value);
      const code = url.searchParams.get("code");
      const token = url.searchParams.get("token");
      if (code) {
        setQuizCode(code.toUpperCase());
      }
      if (token) {
        setQrToken(token);
      }
      setScanStatus("QR code detected.");
      return;
    } catch {
      // Not a URL, fallback to code extraction.
    }

    const match = value.trim().match(/[A-Za-z0-9]{6}/);
    if (match?.[0]) {
      setQuizCode(match[0].toUpperCase());
      setScanStatus("QR code detected.");
    }
  }, []);

  const getCameraDeniedMessage = useCallback(() => {
    if (typeof window === "undefined") return "Camera permission denied. Please enable it in your browser settings and try again.";
    const host = window.location.host;
    const ua = window.navigator.userAgent || "";
    const isiOS = /iPad|iPhone|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    if (isiOS) {
      return "Camera permission denied. Enable it in Settings > Safari > Camera, then reopen the app.";
    }
    if (isAndroid) {
      return `Camera permission denied. Enable it in Chrome Settings > Site settings > Camera and allow ${host}.`;
    }
    return "Camera permission denied. Please enable it in your browser settings and try again.";
  }, []);

  const focusManualEntry = useCallback(() => {
    stopScan();
    setTimeout(() => quizCodeRef.current?.focus(), 50);
  }, [stopScan]);

  const startScan = useCallback(async () => {
    if (isScanning) return;
    setScanError(null);
    setScanStatus("Starting camera...");

    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      setScanError("Camera requires a secure connection (HTTPS) or localhost.");
      setScanStatus(null);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("Camera access is not available.");
      setScanStatus(null);
      return;
    }

    if (!html5CtorRef.current) {
      setScanError("Scanner is still loading. Please try again.");
      setScanStatus(null);
      return;
    }

    setIsScanning(true);

    try {
      const Html5QrcodeCtor = html5CtorRef.current;
      const scanner = new Html5QrcodeCtor(scannerContainerId);
      html5ScannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText: string) => {
          applyScanValue(decodedText);
          stopScan();
        },
        () => null
      );
      setScanStatus("Scanning...");
    } catch (error) {
      const errorName = typeof error === "string" ? error : (error as any)?.name ?? "";
      const errorText = typeof error === "string" ? error : String((error as any)?.message ?? errorName);
      console.error("Unable to start scanner", error);
      if (html5ScannerRef.current) {
        const scanner = html5ScannerRef.current;
        html5ScannerRef.current = null;
        Promise.resolve()
          .then(() => scanner.stop?.())
          .then(() => scanner.clear?.())
          .catch(() => null);
      }
      if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError" || /permission/i.test(errorText)) {
        setScanError(getCameraDeniedMessage());
      } else if (errorName === "NotFoundError" || /not found/i.test(errorText)) {
        setScanError("No camera found on this device.");
      } else if (errorName === "NotReadableError" || /in use/i.test(errorText)) {
        setScanError("Camera is already in use by another app.");
      } else {
        setScanError("Unable to access the camera. Please try again.");
      }
      setScanStatus(null);
    }
  }, [applyScanValue, getCameraDeniedMessage, isScanning, stopScan]);

  useEffect(() => {
    return () => stopScan();
  }, [stopScan]);

  const handleStart = async () => {
    if (!quizCode.trim() || !studentId.trim()) {
      setErrorMessage("Quiz code and student ID are required.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/assessments/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizCode: quizCode.trim(),
          qrToken,
          studentId: studentId.trim(),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? "Unable to access quiz.");
      }
      setAssessment(data.assessment);
      setAttemptId(Number(data.attemptId));
      setStudentName(data?.student?.name ?? null);
      setStudentLrn(data?.student?.lrn ?? studentId.trim());
      setCompletedSummary(null);
      setShowAssessment(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to access quiz.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (showAssessment && assessment && attemptId) {
    return (
      <RemedialAssessment
        assessment={assessment}
        attemptId={attemptId}
        onComplete={(summary) => {
          setCompletedSummary(summary);
          setShowAssessment(false);
        }}
      />
    );
  }

  const Background = () => (
    <>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(209,255,222,0.45),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(188,240,214,0.35),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,249,245,0.95))]" />
      <div className="pointer-events-none absolute left-[10%] right-[50%] top-32 -z-10 h-56 rounded-3xl bg-linear-to-br from-green-200/50 via-white/40 to-transparent blur-4xl" />
      <div className="pointer-events-none absolute left-[55%] right-[10%] bottom-16 -z-10 h-56 rounded-[40px] bg-linear-to-t from-green-200/60 via-white/35 to-transparent blur-4xl" />
    </>
  );

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 text-[#013300] relative overflow-hidden">
      <Background />

      <motion.div
        initial={mounted ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {!isStandalone ? (
          <div className="bg-white/85 backdrop-blur-sm rounded-3xl shadow-xl w-full border-4 border-[#013300] p-8 space-y-6">
            <div className="flex flex-col items-center">
              <Image
                src="/RPT-SAES/RPTLogo.png"
                alt="RPT-SAES Logo"
                width={72}
                height={72}
                className="h-16 w-16 object-contain drop-shadow-md"
              />
              <h1 className="text-3xl font-bold bg-linear-to-r from-green-800 to-[#013300] bg-clip-text text-transparent mt-3">RPT Quiz</h1>
              <p className="text-[#013300]/70 font-medium mt-1">Assessment Portal</p>
            </div>

            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#013300]/50">Before You Install</p>
              <h2 className="text-2xl font-bold text-[#013300] mt-2">Get Ready for Your Quiz</h2>
              <p className="text-sm text-[#013300]/60 mt-2">
                Install the app so you can access quizzes quickly and work smoothly even with a weak connection.
              </p>
            </div>

            <div className="rounded-2xl border border-green-100/80 bg-white/70 p-4 space-y-3 text-sm text-[#013300]/80">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-6 w-6 rounded-full bg-green-100 text-[#013300] flex items-center justify-center text-xs font-bold">1</span>
                <p>Tap the install button to add RPT Quiz to your home screen.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-6 w-6 rounded-full bg-green-100 text-[#013300] flex items-center justify-center text-xs font-bold">2</span>
                <p>Open the app from your home screen after it installs.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-6 w-6 rounded-full bg-green-100 text-[#013300] flex items-center justify-center text-xs font-bold">3</span>
                <p>Enter the quiz code and your LRN to begin.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <InstallPWAButton />
              <p className="text-xs text-center text-[#013300]/50">Already installed? Open the app and start your quiz.</p>
            </div>
          </div>
        ) : completedSummary ? (
          <div className="bg-white/85 backdrop-blur-sm rounded-3xl shadow-xl w-full border border-green-100/60 p-8">
            <div className="flex flex-col items-center mb-10">
              <Image
                src="/RPT-SAES/RPTLogo.png"
                alt="RPT-SAES Logo"
                width={72}
                height={72}
                className="h-16 w-16 object-contain drop-shadow-md"
              />
              <h1 className="text-3xl font-bold bg-linear-to-r from-green-800 to-[#013300] bg-clip-text text-transparent mt-3">RPT Quiz</h1>
              <p className="text-[#013300]/70 font-medium mt-1">Assessment Portal</p>
            </div>

            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#013300]/50">Completion</p>
              <h2 className="text-2xl font-bold text-[#013300] mt-2">Quiz Submitted</h2>
              <p className="text-sm text-[#013300]/60 mt-2">Your answers have been recorded.</p>
            </div>

            <div className="mt-6 rounded-2xl border border-green-100/80 bg-white/70 p-4 text-center">
              <p className="text-sm font-semibold text-[#013300]">{studentName ?? "Student"}</p>
              {studentLrn && (
                <p className="text-xs text-[#013300]/60 mt-1">LRN: {studentLrn}</p>
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-green-50 border border-green-100 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#013300]/50">Score</p>
                <p className="text-3xl font-bold text-[#013300] mt-2">{completedSummary.score}</p>
              </div>
              <div className="rounded-2xl bg-green-50 border border-green-100 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#013300]/50">Correct</p>
                <p className="text-3xl font-bold text-[#013300] mt-2">{completedSummary.correct}</p>
              </div>
              <div className="rounded-2xl bg-white border border-green-100 p-4 col-span-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#013300]/50">Incorrect</p>
                <p className="text-2xl font-semibold text-[#013300] mt-2">{completedSummary.incorrect}</p>
                <p className="text-xs text-[#013300]/60 mt-1">Out of {completedSummary.total} questions</p>
              </div>
            </div>

            <PrimaryButton
              onClick={() => {
                window.location.href = "/PWA";
              }}
              className="w-full mt-6 py-3.5 rounded-xl text-base font-semibold"
            >
              Back to Assessment Landing Page
            </PrimaryButton>
          </div>
        ) : (
          <div className="bg-white/85 backdrop-blur-sm rounded-3xl shadow-xl w-full border-2 border-[#013300] p-8">
            <div className="flex flex-col items-center mb-10">
              <Image
                src="/RPT-SAES/RPTLogo.png"
                alt="RPT-SAES Logo"
                width={72}
                height={72}
                className="h-16 w-16 object-contain drop-shadow-md"
              />
              <h1 className="text-3xl font-bold bg-linear-to-r from-green-800 to-[#013300] bg-clip-text text-transparent mt-3">RPT Quiz</h1>
              <p className="text-[#013300]/70 font-medium mt-1">Assessment Portal</p>
            </div>

            <div className="space-y-4">
              <div>
                <button
                  type="button"
                  onClick={startScan}
                  className="w-full mb-3 rounded-xl border-2 border-[#013300]/20 bg-white/70 py-3 text-lg font-bold text-[#013300] shadow-sm transition hover:border-[#013300]/40"
                >
                  Scan QR Code
                </button>
                <div className="flex items-center justify-center gap-3 text-xs uppercase tracking-[0.25em] text-[#013300]/40 mb-3">
                  <span className="h-px flex-1 bg-[#013300]/10" />
                  or
                  <span className="h-px flex-1 bg-[#013300]/10" />
                </div>
                <input
                  type="text"
                  placeholder="Enter Quiz Code"
                  value={quizCode}
                  onChange={(e) => setQuizCode(e.target.value.toUpperCase())}
                  ref={quizCodeRef}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-[#013300]/20 shadow-sm focus:border-[#013300] focus:ring-0 outline-none transition-all bg-white text-[#013300] placeholder-gray-400 text-center font-bold text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#013300]/80 mb-2">Student LRN</label>
                <input
                  type="text"
                  placeholder="Enter LRN"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-[#013300]/20 shadow-sm focus:border-[#013300] focus:ring-0 outline-none transition-all bg-white text-[#013300] placeholder-gray-400 text-center font-bold text-lg"
                />
              </div>
            </div>

            {errorMessage && (
              <p className="text-sm text-red-600 mt-4 text-center">{errorMessage}</p>
            )}

            {scanError && (
              <p className="text-sm text-red-600 mt-2 text-center">{scanError}</p>
            )}
            {scanError && (
              <button
                type="button"
                onClick={focusManualEntry}
                className="mt-2 w-full rounded-lg bg-green-50 py-2 text-xs font-semibold text-[#1b5e20] hover:bg-green-100"
              >
                Enter code manually
              </button>
            )}

            <PrimaryButton
              onClick={handleStart}
              className="w-full mt-6 py-3.5 rounded-xl text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? "Starting..." : "Start Quiz"}
            </PrimaryButton>
          </div>
        )}
      </motion.div>

      <div
        className={
          isScanning
            ? "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 opacity-100"
            : "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 opacity-0 pointer-events-none"
        }
        aria-hidden={!isScanning}
      >
        <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl space-y-3">
          <h2 className="text-center text-base font-semibold text-[#1b5e20]">Scan QR Code</h2>
          <div className="overflow-hidden rounded-xl bg-black">
            <div id={scannerContainerId} className="w-full h-64" />
          </div>
          <p className="text-xs text-gray-600 text-center">Point your camera at the QR code.</p>
          {scanStatus && (
            <p className="text-xs text-[#1b5e20] text-center">{scanStatus}</p>
          )}
          {scanError && (
            <p className="text-xs text-red-600 text-center">{scanError}</p>
          )}
          {scanError && (
            <button
              type="button"
              onClick={focusManualEntry}
              className="w-full rounded-lg bg-green-50 py-2 text-xs font-semibold text-[#1b5e20] hover:bg-green-100"
            >
              Enter code manually
            </button>
          )}
          <button
            type="button"
            onClick={stopScan}
            className="w-full rounded-lg bg-gray-100 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}