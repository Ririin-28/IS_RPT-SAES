"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { FiChevronLeft } from "react-icons/fi";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import RemedialAssessment from "../RemedialAssessment/RemedialAssessment";

type StudentQuizAccessProps = {
  onBack: () => void;
};

export default function StudentQuizAccess({ onBack }: StudentQuizAccessProps) {
  const [quizCode, setQuizCode] = useState("");
  const [studentId, setStudentId] = useState("");
  const [showQuizIntro, setShowQuizIntro] = useState(false);
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

  const formatStudentLrn = useCallback((value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 12);
    if (digits.length <= 6) {
      return digits;
    }
    return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  }, []);

  useEffect(() => {
    setMounted(true);
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
      // Not a URL, fall back to code extraction.
    }

    const match = value.trim().match(/[A-Za-z0-9]{6}/);
    if (match?.[0]) {
      setQuizCode(match[0].toUpperCase());
      setScanStatus("QR code detected.");
    }
  }, []);

  const getCameraDeniedMessage = useCallback(() => {
    if (typeof window === "undefined") {
      return "Camera permission denied. Please enable it in your browser settings and try again.";
    }
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
        () => null,
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
      setShowQuizIntro(true);
      setShowAssessment(false);
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

  const quizTitle = String(assessment?.title ?? "RPT Quiz");
  const quizDescription = String(assessment?.description ?? "").trim();
  const quizQuestions = Array.isArray(assessment?.questions) ? assessment.questions.length : 0;
  const isFilipinoAssessment = String(assessment?.subjectName ?? "").trim().toLowerCase() === "filipino";
  const introText = isFilipinoAssessment
    ? {
        ready: "Handa ka na ba",
        details: "Detalye ng Quiz",
        questions: "Mga Tanong",
        student: "Mag-aaral",
        learner: "Mag-aaral",
        start: "Simulan ang Quiz",
      }
    : {
        ready: "Ready to start",
        details: "Quiz details",
        questions: "Questions",
        student: "Student",
        learner: "Learner",
        start: "Start Quiz",
      };

  const totalQuestions = completedSummary?.total ?? 0;
  const rightAnswers = completedSummary?.correct ?? 0;
  const wrongAnswers = completedSummary?.incorrect ?? 0;
  const scorePercent = totalQuestions > 0 ? Math.round((rightAnswers / totalQuestions) * 100) : 0;
  const scoreFraction = `${rightAnswers}/${totalQuestions}`;
  const summaryMessage = (() => {
    if (scorePercent === 100) {
      return {
        title: "Perfect Score!",
        message: "Excellent! You got everything right.",
      };
    }
    if (scorePercent >= 85) {
      return {
        title: "Great Job!",
        message: "Awesome work! You almost got all right.",
      };
    }
    if (scorePercent >= 50) {
      return {
        title: "Good Job!",
        message: "You did well. Practice a little more.",
      };
    }
    if (scorePercent >= 25) {
      return {
        title: "Nice Try!",
        message: "You got some right. Keep going!",
      };
    }
    return {
      title: "Good Try!",
      message: "You are learning. Let's practice more.",
    };
  })();

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-[#edf0ee] text-[#013300]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(209,255,222,0.45),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(188,240,214,0.35),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,249,245,0.95))]" />
      <div className="pointer-events-none absolute left-[10%] right-[50%] top-32 -z-10 h-56 rounded-3xl bg-linear-to-br from-green-200/50 via-white/40 to-transparent blur-4xl" />
      <div className="pointer-events-none absolute left-[55%] right-[10%] bottom-16 -z-10 h-56 rounded-[40px] bg-linear-to-t from-green-200/60 via-white/35 to-transparent blur-4xl" />

      <button
        type="button"
        onClick={onBack}
        className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 inline-flex items-center gap-1 text-base font-semibold leading-none text-[#013300]/80 transition hover:text-[#013300]"
        aria-label="Back"
      >
        <FiChevronLeft className="h-5 w-5" />
        <span className="leading-none">Back</span>
      </button>

      <motion.div
        initial={mounted ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative mt-[calc(env(safe-area-inset-top)+3rem)] flex min-h-[calc(100dvh-env(safe-area-inset-top)-3rem)] w-full flex-col justify-center overflow-y-auto rounded-t-[30px] bg-[#f7f8f7] px-4 pt-6 pb-7"
      >
        {completedSummary ? (
          <div className="mx-auto w-full max-w-[36rem] rounded-[28px] border border-green-100/70 bg-white p-4 shadow-xl sm:p-6 md:p-7">
            <div className="flex flex-col items-center mb-7 mt-2">
              <Image
                src="/RPT-SAES/RPTLogo.png"
                alt="RPT-SAES Logo"
                width={72}
                height={72}
                className="h-14 w-14 object-contain drop-shadow-md sm:h-16 sm:w-16"
              />
              <h1 className="mt-3 text-[2rem] font-bold bg-linear-to-r from-green-800 to-[#013300] bg-clip-text text-transparent sm:text-3xl">
                RPT Quiz
              </h1>
              <p className="mt-1 text-sm font-medium text-[#013300]/70 sm:text-base">Quiz Done</p>
            </div>

            <div className="rounded-2xl border border-green-100 bg-[#f7fbf7] p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#013300]/55">Your Score</p>
              <p className="mt-2 text-5xl font-black tracking-tight text-[#013300]">{scoreFraction}</p>
              <p className="mt-1 text-3xl font-black text-[#013300]">{scorePercent}%</p>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#013300]/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${scorePercent}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full bg-[#46a301]"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#013300]/55">Correct</p>
                <p className="mt-2 text-4xl font-black text-[#2f8e00]">{rightAnswers}</p>
              </div>
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#013300]/55">Incorrect</p>
                <p className="mt-2 text-4xl font-black text-[#c21b37]">{wrongAnswers}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-green-100 bg-white p-4 text-center">
              <h2 className="text-2xl font-black tracking-tight text-[#013300]">{summaryMessage.title}</h2>
              <p className="mt-2 text-sm font-semibold text-[#013300]/72">{summaryMessage.message}</p>
            </div>

            <PrimaryButton onClick={onBack} className="w-full mt-6 py-3.5 rounded-xl text-base font-semibold">
              Go Back
            </PrimaryButton>
          </div>
        ) : showQuizIntro && assessment && attemptId ? (
          <div className="mx-auto w-full max-w-[36rem] rounded-[28px] border border-green-100/70 bg-white p-4 shadow-xl sm:p-6 md:p-7">
            <div className="flex flex-col items-center text-center mb-6 mt-1">
              <Image
                src="/RPT-SAES/RPTLogo.png"
                alt="RPT-SAES Logo"
                width={72}
                height={72}
                className="h-14 w-14 object-contain drop-shadow-md sm:h-16 sm:w-16"
              />
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#013300]/55">{introText.ready}</p>
              <h1 className="mt-2 text-[1.9rem] font-black leading-[1.02] tracking-[-0.04em] text-[#013300] sm:text-4xl">
                {quizTitle}
              </h1>
              {quizDescription ? (
                <p className="mt-2 max-w-xl text-sm font-medium text-[#013300]/70 sm:text-base">{quizDescription}</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-green-100 bg-[#f7fbf7] p-4 text-center sm:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#013300]/55">{introText.details}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl border border-green-100 bg-white p-3">
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.15em] text-[#013300]/55">{introText.questions}</p>
                  <p className="mt-1 text-2xl font-black text-[#013300]">{quizQuestions}</p>
                </div>
                <div className="rounded-xl border border-green-100 bg-white p-3">
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.15em] text-[#013300]/55">{introText.student}</p>
                  <p className="mt-1 text-sm font-bold text-[#013300]">{studentName || studentLrn || introText.learner}</p>
                </div>
              </div>
            </div>

            <PrimaryButton
              onClick={() => {
                setShowQuizIntro(false);
                setShowAssessment(true);
              }}
              className="w-full mt-6 py-3.5 rounded-xl text-base font-semibold"
            >
              {introText.start}
            </PrimaryButton>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-md">
            <div className="flex flex-col items-center mb-10 mt-4">
              <Image
                src="/RPT-SAES/RPTLogo.png"
                alt="RPT-SAES Logo"
                width={72}
                height={72}
                className="h-14 w-14 object-contain drop-shadow-md sm:h-16 sm:w-16"
              />
              <h1 className="mt-3 text-[2rem] font-bold bg-linear-to-r from-green-800 to-[#013300] bg-clip-text text-transparent sm:text-3xl">
                RPT Quiz
              </h1>
              <p className="mt-1 text-sm font-medium text-[#013300]/70 sm:text-base">Student Assessment</p>
            </div>

            <div className="space-y-4">
              <div>
                <button
                  type="button"
                  onClick={startScan}
                  className="mb-3 min-h-[56px] w-full rounded-xl border-2 border-[#013300]/20 bg-white/70 px-4 py-3 text-lg font-bold text-[#013300] shadow-sm transition hover:border-[#013300]/40"
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
                  className="w-full rounded-xl border-2 border-[#013300]/20 bg-white px-4 py-3.5 text-center text-lg font-bold text-[#013300] shadow-sm outline-none transition-all placeholder-gray-400 focus:border-[#013300] focus:ring-0"
                />
              </div>

              <div className="mt-10">
                <label className="block text-sm font-bold text-[#013300]/80 mb-2">Student LRN</label>
                <input
                  type="text"
                  placeholder="000000-000000"
                  value={studentId}
                  onChange={(e) => setStudentId(formatStudentLrn(e.target.value))}
                  inputMode="numeric"
                  maxLength={13}
                  className="w-full rounded-xl border-2 border-[#013300]/20 bg-white px-4 py-3.5 text-center text-lg font-bold text-[#013300] shadow-sm outline-none transition-all placeholder-gray-400 focus:border-[#013300] focus:ring-0"
                />
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100">
                <p className="text-sm text-red-600 text-center font-medium">{errorMessage}</p>
              </div>
            ) : null}

            {scanError ? <p className="text-sm text-red-600 mt-2 text-center">{scanError}</p> : null}
            {scanError ? (
              <button
                type="button"
                onClick={focusManualEntry}
                className="mt-2 w-full rounded-lg bg-green-50 py-2 text-xs font-semibold text-[#1b5e20] hover:bg-green-100"
              >
                Enter code manually
              </button>
            ) : null}

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
            ? "fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 opacity-100 sm:items-center sm:p-4"
            : "fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 opacity-0 pointer-events-none sm:items-center sm:p-4"
        }
        aria-hidden={!isScanning}
      >
        <div
          className="max-h-[88dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-[24px] bg-white p-4 shadow-xl sm:rounded-2xl"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <h2 className="text-center text-base font-semibold text-[#1b5e20]">Scan QR Code</h2>
          <div className="overflow-hidden rounded-xl bg-black">
            <div id={scannerContainerId} className="w-full h-64" />
          </div>
          <p className="text-xs text-gray-600 text-center">Point your camera at the QR code.</p>
          {scanStatus ? <p className="text-xs text-[#1b5e20] text-center">{scanStatus}</p> : null}
          {scanError ? <p className="text-xs text-red-600 text-center">{scanError}</p> : null}
          {scanError ? (
            <button
              type="button"
              onClick={focusManualEntry}
              className="w-full rounded-lg bg-green-50 py-2 text-xs font-semibold text-[#1b5e20] hover:bg-green-100"
            >
              Enter code manually
            </button>
          ) : null}
          <button
            type="button"
            onClick={stopScan}
            className="min-h-[46px] w-full rounded-lg bg-gray-100 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
