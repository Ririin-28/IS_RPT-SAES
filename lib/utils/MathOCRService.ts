export interface MathProblem {
  question: string;
  answer: string;
}

export class MathOCRService {
  private static OPERATORS_REGEX = /\b(\d{1,3})\s*([+\-×x*÷/])\s*(\d{1,3})\b/g;

  /**
   * Extracts math expressions from text and solves them.
   * @param text The text to parse.
   * @returns Array of valid MathProblem objects.
   */
  static extractAndSolve(text: string): MathProblem[] {
    const problems: MathProblem[] = [];
    let match;

    // Normalize text: replace common OCR mistakes or symbols
    // 'x' or 'X' -> '*'
    // '÷' -> '/'
    const normalizedText = text
      .replace(/×/g, '*')
      .replace(/x/g, '*')
      .replace(/X/g, '*')
      .replace(/÷/g, '/');

    // We need to reset the lastIndex because we're using a global regex
    const regex = new RegExp(this.OPERATORS_REGEX);
    
    // Iterate over all matches
    while ((match = regex.exec(normalizedText)) !== null) {
      const [, leftOp, operator, rightOp] = match;
      
      const left = parseInt(leftOp, 10);
      const right = parseInt(rightOp, 10);
      
      // Constraint: Integer operands 0 to 999
      if (left > 999 || right > 999) continue;

      let result: number | null = null;
      let symbol = operator;

      switch (operator) {
        case '+':
          result = left + right;
          break;
        case '-':
          result = left - right;
          break;
        case '*':
          result = left * right;
          symbol = '×'; // Display symbol
          break;
        case '/':
          if (right === 0) continue; // Avoid division by zero
          // Integer division as per typical elementary math flashcards? 
          // Or decimal? The prompt implies "exact match", usually integers for simple flashcards.
          // However, "integer operands" doesn't imply integer results. 
          // Let's assume standard division but we might want to format it.
          // If the prompt says "Validation... marking any response that does not exactly match",
          // and "integer operands", usually it's integer division or exact decimal.
          // Let's stick to simple division.
          result = left / right;
          symbol = '÷';
          break;
      }

      if (result !== null) {
        // Format result: if integer, stringify. If float, maybe limit decimals?
        // For 0-999 operands, division can be recurring.
        // Let's assume standard formatting. 
        // NOTE: User requirement says "integer operands", usually implies integer answers for primary/remedial math,
        // but let's support decimals if they occur, or maybe filter out non-integers if it's strictly "basic arithmetic" for remedial.
        // For safety, we'll convert to string.
        
        // However, if the result is 1.33333, "exactly match" is hard.
        // Let's limit to 2 decimal places if not integer?
        // Or maybe just standard string conversion.
        const answerStr = Number.isInteger(result) ? result.toString() : result.toFixed(2).replace(/\.00$/, '');

        problems.push({
          question: `${left} ${symbol} ${right}`,
          answer: answerStr
        });
      }
    }

    return problems;
  }
}
