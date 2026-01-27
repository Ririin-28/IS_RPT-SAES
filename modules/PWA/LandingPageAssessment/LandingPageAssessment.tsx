"use client";

import React, { useState, useEffect } from "react";
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
    </div>
  );
}