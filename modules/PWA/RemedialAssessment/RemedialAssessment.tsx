"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";


export default function RemedialAssessment() {
  const [current, setCurrent] = useState(0);

  const quizItems = [
    {
      id: 1,
      question: "Which picture matches the word?",
      choices: ["/img/cat.png", "/img/dog.png", "/img/bird.png"],
      answer: 0,
      type: "image-choice",
    },
    {
      id: 2,
      question: "Read the word and choose the correct picture.",
      word: "SUN",
      choices: ["/img/sun.png", "/img/moon.png", "/img/star.png"],
      answer: 0,
      type: "word-to-image",
    },
    {
      id: 3,
      question: "What letter does the word 'apple' start with?",
      choices: ["A", "E", "O"],
      answer: 0,
      type: "multiple-choice",
    },
  ];

  const handleSelect = (index: number) => {
    setCurrent((prev) => Math.min(prev + 1, quizItems.length - 1));
  };

  const item = quizItems[current];

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl shadow-lg">
          <div className="p-5 space-y-5">
            <h2 className="text-xl font-bold text-center text-[#1b5e20]">
              Question {current + 1} / {quizItems.length}
            </h2>

            <p className="text-md font-medium text-gray-700 text-center">
              {item.question}
            </p>

            {/* For word-based question */}
            {item.word && (
              <div className="text-center text-3xl font-extrabold text-[#2e7d32]">
                {item.word}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 mt-4">
              {item.choices.map((choice, index) => (
                <UtilityButton
                  key={index}
                  onClick={() => handleSelect(index)}
                  className="w-full py-4 rounded-xl text-base font-semibold"
                >
                  {choice.endsWith(".png") || choice.endsWith(".jpg") ? (
                    <img
                      src={choice}
                      alt="choice"
                      className="mx-auto w-20 h-20 object-contain"
                    />
                  ) : (
                    choice
                  )}
                </UtilityButton>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}