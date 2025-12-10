"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import InstallPWAButton from "@/components/Common/Buttons/InstallPWAButton";
import RemedialAssessment from "../RemedialAssessment/RemedialAssessment";

export default function LandingPageAssessment() {
  const [quizCode, setQuizCode] = useState("");
  const [studentId, setStudentId] = useState("");
  const [surname, setSurname] = useState("");
  const [showAssessment, setShowAssessment] = useState(false);

  const handleStart = () => {
    setShowAssessment(true);
  };

  if (showAssessment) {
    return <RemedialAssessment />;
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#e8f5e9] to-white flex items-center justify-center p-4 relative">
      {/* Floating install button - bottom right */}
      <div className="fixed bottom-6 right-6 z-50">
        <InstallPWAButton />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="rounded-2xl shadow-lg p-2">
          <div className="p-4 space-y-4">
            <h1 className="text-center text-2xl font-bold text-[#1b5e20]">
              Quiz Access
            </h1>
            <p className="text-center text-sm text-gray-600">
              Enter the required details to start the quiz.
            </p>

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

            <PrimaryButton
              onClick={handleStart}
              className="w-full mt-4 py-3 rounded-xl text-base font-semibold"
            >
              Start Quiz
            </PrimaryButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}