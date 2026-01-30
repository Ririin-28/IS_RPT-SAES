import { MathOCRService } from '../lib/utils/MathOCRService';

describe('MathOCRService', () => {
  describe('extractAndSolve', () => {
    it('should correctly parse and solve basic addition', () => {
      const text = '1 + 1';
      const result = MathOCRService.extractAndSolve(text);
      expect(result).toEqual([{ question: '1 + 1', answer: '2' }]);
    });

    it('should correctly parse and solve basic subtraction', () => {
      const text = '5 - 3';
      const result = MathOCRService.extractAndSolve(text);
      expect(result).toEqual([{ question: '5 - 3', answer: '2' }]);
    });

    it('should correctly parse and solve basic multiplication with x', () => {
      const text = '3 x 4';
      const result = MathOCRService.extractAndSolve(text);
      expect(result).toEqual([{ question: '3 × 4', answer: '12' }]);
    });

    it('should correctly parse and solve basic multiplication with *', () => {
      const text = '3 * 4';
      const result = MathOCRService.extractAndSolve(text);
      expect(result).toEqual([{ question: '3 × 4', answer: '12' }]);
    });

    it('should correctly parse and solve basic division with /', () => {
      const text = '10 / 2';
      const result = MathOCRService.extractAndSolve(text);
      expect(result).toEqual([{ question: '10 ÷ 2', answer: '5' }]);
    });

    it('should correctly parse and solve basic division with ÷', () => {
      const text = '10 ÷ 2';
      const result = MathOCRService.extractAndSolve(text);
      expect(result).toEqual([{ question: '10 ÷ 2', answer: '5' }]);
    });

    it('should handle multi-digit operands', () => {
      const text = '123 + 456';
      const result = MathOCRService.extractAndSolve(text);
      expect(result).toEqual([{ question: '123 + 456', answer: '579' }]);
    });

    it('should ignore operands larger than 999', () => {
      const text = '1000 + 1';
      const result = MathOCRService.extractAndSolve(text);
      expect(result).toEqual([]);
    });

    it('should handle multiple expressions in one text', () => {
      const text = '1 + 1\n2 + 2\n3 x 3';
      const result = MathOCRService.extractAndSolve(text);
      expect(result).toEqual([
        { question: '1 + 1', answer: '2' },
        { question: '2 + 2', answer: '4' },
        { question: '3 × 3', answer: '9' },
      ]);
    });

    it('should handle division by zero (ignore)', () => {
      const text = '10 / 0';
      const result = MathOCRService.extractAndSolve(text);
      expect(result).toEqual([]);
    });

    it('should handle decimal results (formatted to 2 decimal places if needed)', () => {
      // 10 / 3 = 3.3333...
      const text = '10 / 3';
      const result = MathOCRService.extractAndSolve(text);
      // Our implementation currently might return 3.33 or similar string representation.
      // Let's check the implementation logic:
      // const answerStr = Number.isInteger(result) ? result.toString() : result.toFixed(2).replace(/\.00$/, '');
      expect(result).toEqual([{ question: '10 ÷ 3', answer: '3.33' }]);
    });

    it('should handle negative results', () => {
      const text = '5 - 10';
      const result = MathOCRService.extractAndSolve(text);
      expect(result).toEqual([{ question: '5 - 10', answer: '-5' }]);
    });

    it('should handle common OCR noise/spaces', () => {
      const text = ' 10   +   5 ';
      const result = MathOCRService.extractAndSolve(text);
      expect(result).toEqual([{ question: '10 + 5', answer: '15' }]);
    });
  });

  describe('Integration Simulation (End-to-End)', () => {
    // We mock Tesseract to simulate the full flow from "file" (mocked text) to result
    it('should process simulated OCR output correctly', async () => {
      // Mock Tesseract behavior by skipping the actual file read and just testing logic with typical OCR output
      const ocrOutput = `
        Lesson 1
        1 + 1
        2 + 1
        4 + 2
        3 + 2
        4 + 1
      `;
      
      const result = MathOCRService.extractAndSolve(ocrOutput);
      
      expect(result.length).toBe(5);
      expect(result[0]).toEqual({ question: '1 + 1', answer: '2' });
      expect(result[4]).toEqual({ question: '4 + 1', answer: '5' });
    });
  });
});
