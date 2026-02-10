"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import InstallPWAButton from "@/components/Common/Buttons/InstallPWAButton";
import RemedialAssessment from "../RemedialAssessment/RemedialAssessment";

export default function LandingPageAssessment() {
  const [quizCode, setQuizCode] = useState("");
  const [studentId, setStudentId] = useState("");
  const [surname, setSurname] = useState("");
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessment, setAssessment] = useState<any | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedScore, setCompletedScore] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<any | null>(null);

  useEffect(() => {
    setMounted(true);
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
    if (scanFrameRef.current) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    detectorRef.current = null;
    setIsScanning(false);
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
      return;
    } catch {
      // Not a URL, fallback to code extraction.
    }

    const match = value.trim().match(/[A-Za-z0-9]{6}/);
    if (match?.[0]) {
      setQuizCode(match[0].toUpperCase());
    }
  }, []);

  const startScan = useCallback(async () => {
    if (isScanning) return;
    setScanError(null);

    if (typeof window === "undefined") return;
    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      setScanError("QR scanning is not supported on this device.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("Camera access is not available.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      detectorRef.current = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      setIsScanning(true);

      const scanLoop = async () => {
        if (!videoRef.current || !detectorRef.current) return;
        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          if (Array.isArray(barcodes) && barcodes.length > 0) {
            const rawValue = barcodes[0]?.rawValue ?? "";
            applyScanValue(rawValue);
            stopScan();
            return;
          }
        } catch (error) {
          console.warn("QR scan error", error);
        }
        scanFrameRef.current = requestAnimationFrame(scanLoop);
      };

      scanFrameRef.current = requestAnimationFrame(scanLoop);
    } catch (error) {
      console.error("Unable to start scanner", error);
      setScanError("Unable to access the camera. Please allow permission.");
      stopScan();
    }
  }, [applyScanValue, isScanning, stopScan]);

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
        onComplete={(score) => {
          setCompletedScore(score);
          setShowAssessment(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#e8f5e9] to-white flex items-center justify-center p-4 relative">
      {/* Floating install button - bottom right */}
      <div className="fixed bottom-6 right-6 z-50">
        <InstallPWAButton />
      </div>

      <motion.div
        initial={mounted ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="rounded-2xl shadow-lg p-2">
          <div className="p-4 space-y-4">
            {/* Quiz Icon Section */}
            <div className="flex justify-center mb-2">
              <motion.div
                initial={mounted ? { scale: 0.8, rotate: -10 } : false}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="w-20 h-20 rounded-full bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] flex items-center justify-center shadow-md"
              >
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              </motion.div>
            </div>

            <h1 className="text-center text-2xl font-bold text-[#1b5e20]">
              Quiz Time!
            </h1>

            <div className="space-y-3 mt-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Quiz Code</label>
                <input
                  type="text"
                  placeholder="Enter Quiz Code"
                  value={quizCode}
                  onChange={(e) => setQuizCode(e.target.value)}
                  className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b5e20] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={startScan}
                  className="mt-2 w-full rounded-lg border border-[#1b5e20] text-[#1b5e20] py-2 text-sm font-semibold hover:bg-[#1b5e20] hover:text-white transition"
                >
                  Scan QR Code
                </button>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Student ID</label>
                <input
                  type="text"
                  placeholder="Enter Student ID"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b5e20] focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Surname</label>
                <input
                  type="text"
                  placeholder="Enter Surname"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b5e20] focus:border-transparent"
                />
              </div>
            </div>

            {errorMessage && (
              <p className="text-sm text-red-600">{errorMessage}</p>
            )}

            {scanError && (
              <p className="text-sm text-red-600">{scanError}</p>
            )}

            {completedScore !== null && (
              <p className="text-sm text-green-700">Quiz submitted. Score: {completedScore}</p>
            )}

            <PrimaryButton
              onClick={handleStart}
              className="w-full mt-4 py-3 rounded-xl text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? "Starting..." : "Start Quiz"}
            </PrimaryButton>
          </div>
        </div>
      </motion.div>

      {isScanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl space-y-3">
            <h2 className="text-center text-base font-semibold text-[#1b5e20]">Scan QR Code</h2>
            <div className="overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} className="w-full h-64 object-cover" playsInline muted />
            </div>
            <p className="text-xs text-gray-600 text-center">Point your camera at the QR code.</p>
            <button
              type="button"
              onClick={stopScan}
              className="w-full rounded-lg bg-gray-100 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}