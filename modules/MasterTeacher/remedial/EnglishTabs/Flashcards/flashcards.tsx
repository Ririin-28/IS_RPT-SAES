"use client";
import { useState } from "react";
import { FaVolumeUp, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { useSearchParams } from "next/navigation";

function highlightSentence(sentence: string, highlights: string[]) {
  const words = sentence.split(/(\s+)/);
  return words.map((word, idx) => {
    const clean = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (highlights.map(h => h.toLowerCase()).includes(clean)) {
      return (
        <span
          key={idx}
          className="bg-blue-100 text-blue-800 rounded px-1 mx-0.5 font-semibold border-b-2 border-blue-300"
        >
          {word}
        </span>
      );
    }
    return word;
  });
}

const flashcardsData = [
  {
    sentence: "The cat sat on the mat.",
    highlights: ["cat", "mat"],
  },
  {
    sentence: "The dog ran fast in the park.",
    highlights: ["dog", "park"],
  },
  {
    sentence: "Birds fly high in the sky.",
    highlights: ["Birds", "sky"],
  },
  {
    sentence: "Fish swim in the blue water.",
    highlights: ["Fish", "water"],
  },
  {
    sentence: "The sun is bright and yellow.",
    highlights: ["sun", "yellow"],
  }
];

export default function MasterTeacherFlashcards() {
  const searchParams = useSearchParams()!;
  const startParam = searchParams.get("start");
  const startIndex = startParam
    ? Math.min(Math.max(parseInt(startParam), 0), flashcardsData.length - 1)
    : 0;

  const [current, setCurrent] = useState(startIndex);
  const { sentence, highlights } = flashcardsData[current];

  const handlePrev = () => {
    setCurrent((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = () => {
    setCurrent((prev) => Math.min(prev + 1, flashcardsData.length - 1));
  };

  const handleSpeak = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utter = new window.SpeechSynthesisUtterance(sentence);
      utter.rate = 0.9;
      window.speechSynthesis.speak(utter);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
  <div className="bg-white rounded-xl shadow-md p-12 w-full h-full max-w-none flex flex-col">
    <h1 className="text-4xl font-bold text-center text-gray-800 mb-4">
      Reading Flashcards
    </h1>
    <p className="text-center text-gray-600 mb-10 text-lg">
      Practice reading with highlighted vocabulary words
    </p>

    {/* Progress indicator */}
    <div className="flex justify-between items-center mb-10">
      <span className="text-lg text-gray-500">
        Card {current + 1} of {flashcardsData.length}
      </span>
      <div className="flex space-x-2">
        {flashcardsData.map((_, i) => (
          <div
            key={i}
            className={`h-3 w-3 rounded-full ${
              i === current ? "bg-blue-500" : "bg-gray-300"
            }`}
          />
        ))}
      </div>
    </div>

    {/* Flashcard content */}
    <div className="bg-blue-50 rounded-lg p-12 mb-10 border border-blue-100 flex-1 flex flex-col justify-center">
      <div className="text-5xl text-center text-gray-800 leading-relaxed mb-8">
        {highlightSentence(sentence, highlights)}
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleSpeak}
          className="flex items-center justify-center text-blue-600 hover:text-blue-800"
          aria-label="Play audio"
        >
          <FaVolumeUp size={28} />
          <span className="ml-3 text-lg">Listen</span>
        </button>
      </div>
    </div>

    {/* Navigation buttons */}
    <div className="flex justify-between mt-auto">
      <button
        onClick={handlePrev}
        disabled={current === 0}
        className="flex items-center px-6 py-3 rounded-lg text-white text-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FaArrowLeft className="mr-3" />
        Previous
      </button>

      <button
        onClick={handleNext}
        disabled={current === flashcardsData.length - 1}
        className="flex items-center px-6 py-3 rounded-lg text-white text-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
        <FaArrowRight className="ml-3" />
      </button>
    </div>
  </div>

  <div className="mt-10 text-center text-md text-gray-500">
    <p>Click highlighted words to hear them pronounced</p>
  </div>
</div>
  );
}