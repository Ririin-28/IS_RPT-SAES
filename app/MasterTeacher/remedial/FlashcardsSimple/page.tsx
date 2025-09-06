"use client";
import { useState } from "react";

const flashcardsData = [
  {
    type: "Consonant",
    cards: [
      { letter: "B", word: "Ball" },
      { letter: "C", word: "Cat" },
      { letter: "D", word: "Dog" },
      { letter: "F", word: "Fish" },
      { letter: "G", word: "Goat" },
    ],
  },
  {
    type: "Vowel",
    cards: [
      { letter: "A", word: "Apple" },
      { letter: "E", word: "Elephant" },
      { letter: "I", word: "Igloo" },
      { letter: "O", word: "Octopus" },
      { letter: "U", word: "Umbrella" },
    ],
  },
];

export default function FlashcardsSimple() {
  const [currentTypeIndex, setCurrentTypeIndex] = useState(0);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const currentType = flashcardsData[currentTypeIndex];
  const currentCard = currentType.cards[currentCardIndex];

  const handleNextCard = () => {
    if (currentCardIndex < currentType.cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    } else if (currentTypeIndex < flashcardsData.length - 1) {
      setCurrentTypeIndex(currentTypeIndex + 1);
      setCurrentCardIndex(0);
    }
  };

  const handlePrevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
    } else if (currentTypeIndex > 0) {
      setCurrentTypeIndex(currentTypeIndex - 1);
      setCurrentCardIndex(flashcardsData[currentTypeIndex - 1].cards.length - 1);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-6">
      <h2 className="text-2xl font-bold mb-4">Simple Flashcards - {currentType.type}</h2>
      <div className="bg-gray-100 rounded-lg shadow p-8 w-full max-w-md text-center">
        <div className="text-6xl font-extrabold mb-4">{currentCard.letter}</div>
        <div className="text-xl mb-6">{currentCard.word}</div>
        <div className="flex justify-between">
          <button
            onClick={handlePrevCard}
            disabled={currentTypeIndex === 0 && currentCardIndex === 0}
            className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={handleNextCard}
            disabled={
              currentTypeIndex === flashcardsData.length - 1 &&
              currentCardIndex === currentType.cards.length - 1
            }
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
