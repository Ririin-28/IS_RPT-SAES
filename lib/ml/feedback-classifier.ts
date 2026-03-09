
import * as tf from "@tensorflow/tfjs";

// 1. Define Feedback Categories (Classes)
export enum FeedbackCategory {
  URGENT_INTERVENTION = 0, // Very low accuracy/speed
  ACCURACY_FOCUS = 1,      // Low accuracy, decent speed
  FLUENCY_FOCUS = 2,       // Decent accuracy, low speed
  REINFORCEMENT = 3,       // Good performance, minor improvements needed
  MASTERY = 4              // Excellent performance
}

// 2. Synthetic Data Generator
// This function creates "ground truth" data based on expert heuristics to bootstrap the model.
function generateFeedbackTrainingData(samplesPerClass = 200) {
  const inputs: number[][] = [];
  const labels: number[] = [];

  const addSample = (accuracy: number, speed: number, avg: number, label: number) => {
    // Add some noise to make it robust
    const noise = () => (Math.random() - 0.5) * 0.1; 
    inputs.push([
      Math.max(0, Math.min(1, accuracy + noise())), 
      Math.max(0, Math.min(1, speed + noise())), 
      Math.max(0, Math.min(1, avg + noise()))
    ]);
    labels.push(label);
  };

  for (let i = 0; i < samplesPerClass; i++) {
    // Class 0: Urgent Intervention (Acc < 0.5, Speed < 0.3)
    addSample(0.3 + Math.random() * 0.2, 0.1 + Math.random() * 0.2, 0.3 + Math.random() * 0.2, FeedbackCategory.URGENT_INTERVENTION);

    // Class 1: Accuracy Focus (Acc < 0.7, Speed > 0.4)
    addSample(0.5 + Math.random() * 0.2, 0.5 + Math.random() * 0.4, 0.6 + Math.random() * 0.2, FeedbackCategory.ACCURACY_FOCUS);

    // Class 2: Fluency Focus (Acc > 0.7, Speed < 0.4)
    addSample(0.8 + Math.random() * 0.2, 0.1 + Math.random() * 0.3, 0.7 + Math.random() * 0.2, FeedbackCategory.FLUENCY_FOCUS);

    // Class 3: Reinforcement (Acc > 0.8, Speed > 0.6)
    addSample(0.85 + Math.random() * 0.1, 0.6 + Math.random() * 0.3, 0.85 + Math.random() * 0.1, FeedbackCategory.REINFORCEMENT);

    // Class 4: Mastery (Acc > 0.9, Speed > 0.8)
    addSample(0.95 + Math.random() * 0.05, 0.85 + Math.random() * 0.15, 0.95 + Math.random() * 0.05, FeedbackCategory.MASTERY);
  }

  return { inputs, labels };
}

// 3. Model Cache
// Use global to persist model across HMR in development
declare global {
  var __feedbackModel: tf.LayersModel | null | undefined;
}

let isTraining = false;

// 4. Train Model (Singleton)
export async function getFeedbackModel() {
  if (globalThis.__feedbackModel) return globalThis.__feedbackModel;
  
  // Prevent race conditions in serverless/async environments (basic check)
  if (isTraining) {
    // Wait for model... (simple retry loop for demo)
    while (isTraining) await new Promise(r => setTimeout(r, 100));
    if (globalThis.__feedbackModel) return globalThis.__feedbackModel;
  }

  isTraining = true;
  try {
    const model = tf.sequential();
    
    // Input Layer: 3 features [Accuracy, NormalizedSpeed, Average]
    const modelId = Date.now().toString();
    model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [3], name: `dense_${modelId}_1` }));
    
    // Hidden Layer
    model.add(tf.layers.dense({ units: 12, activation: 'relu', name: `dense_${modelId}_2` }));
    
    // Output Layer: 5 classes (Softmax)
    model.add(tf.layers.dense({ units: 5, activation: 'softmax', name: `dense_${modelId}_3` }));

    model.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'sparseCategoricalCrossentropy',
      metrics: ['accuracy']
    });

    const { inputs, labels } = generateFeedbackTrainingData();
    const xs = tf.tensor2d(inputs);
    const ys = tf.tensor1d(labels);

    await model.fit(xs, ys, {
      epochs: 20,
      batchSize: 32,
      shuffle: true,
      verbose: 0
    });

    xs.dispose();
    ys.dispose();
    
    globalThis.__feedbackModel = model;
    return model;
  } finally {
    isTraining = false;
  }
}

// 5. Prediction Function
export async function predictFeedbackCategory(
  accuracy: number, // 0-100
  wpm: number,      // 0-150+
  average: number   // 0-100
): Promise<FeedbackCategory> {
  const model = await getFeedbackModel();
  
  return tf.tidy(() => {
    // Normalize Inputs (match training data range 0-1)
    // Assuming max WPM around 150 for normalization context
    const normAcc = Math.max(0, Math.min(1, accuracy / 100));
    const normWpm = Math.max(0, Math.min(1, wpm / 150)); 
    const normAvg = Math.max(0, Math.min(1, average / 100));

    const input = tf.tensor2d([[normAcc, normWpm, normAvg]]);
    const prediction = model.predict(input) as tf.Tensor;
    const classIndex = prediction.argMax(1).dataSync()[0];
    
    return classIndex as FeedbackCategory;
  });
}

// 6. Map Category to Text Templates
// This keeps the "Text Generation" deterministic while "Decision Making" is ML-driven.
export function getFeedbackTemplate(category: FeedbackCategory, studentName: string): string {
  const name = studentName || "Student";
  
  const templates: Record<FeedbackCategory, string[]> = {
    [FeedbackCategory.URGENT_INTERVENTION]: [
      `${name} is finding this material quite challenging. We recommend immediate guided practice sessions focusing on basic phonics and slow, repeated reading.`,
      `It seems ${name} needs significant support with this level. Let's step back to easier texts and build confidence with high-frequency words.`,
      `${name} is struggling with both accuracy and speed. Regular, short remedial sessions (10-15 mins) twice a day are highly comprehensive.`
    ],
    [FeedbackCategory.ACCURACY_FOCUS]: [
      `${name} reads with decent speed but often misreads words. Let's focus on "accuracy first" - encourage ${name} to slow down and sound out tricky words fully.`,
      `Speed is okay, but accuracy needs work. ${name} should practice word lists and phoneme isolation exercises to reduce guessing.`,
      `${name} is skipping or mispronouncing words to keep up speed. Remind ${name} that reading correctly is more important than reading fast right now.`
    ],
    [FeedbackCategory.FLUENCY_FOCUS]: [
      `${name} reads accurately but very slowly. To build fluency, try "choral reading" (reading together) and repeated reading of the same familiar texts.`,
      `Accuracy is good, but ${name} is reading word-by-word. Encourage ${name} to group words into phrases to improve flow and speed.`,
      `${name} has a strong foundation in decoding but needs to pick up the pace. Timed repeated readings of easy stories will help boost automaticity.`
    ],
    [FeedbackCategory.REINFORCEMENT]: [
      `${name} is doing well! To get to the next level, focus on expression and intonation. Keep up the consistent practice routine.`,
      `Good solid performance from ${name}. A little more daily practice will help polish those few tricky words and smooth out the reading flow.`,
      `${name} is on the right track. Continue with the current difficulty level, but challenge ${name} with slightly longer passages occasionally.`
    ],
    [FeedbackCategory.MASTERY]: [
      `Excellent work! ${name} has mastered this material with great speed and accuracy. It's time to move to more advanced texts or higher grade levels.`,
      `${name} is reading fluently and accurately. You might consider introducing more complex vocabulary or comprehension questions to deepen learning.`,
      `Outstanding performance! ${name} is ready for a challenge. Try introducing new genres or longer chapter books to keep engagement high.`
    ]
  };

  const options = templates[category];
  return options[Math.floor(Math.random() * options.length)];
}

export function getEncouragement(category: FeedbackCategory, studentName: string): string {
  const name = studentName || "Student";
  const encouragements: Record<FeedbackCategory, string[]> = {
    [FeedbackCategory.URGENT_INTERVENTION]: [
      `Don't worry, ${name}, every expert was once a beginner!`,
      `Keep your head up, ${name}. Progress takes time, and we're here to help.`,
      `The most important step is simply to keep trying. We believe in ${name}!`
    ],
    [FeedbackCategory.ACCURACY_FOCUS]: [
      `I love the energy ${name} is bringing to the reading sessions!`,
      `${name} has great momentum—now let's channel it into precision.`,
      `It's great to see ${name} diving into the text with such enthusiasm!`
    ],
    [FeedbackCategory.FLUENCY_FOCUS]: [
      `${name} is showing excellent attention to detail.`,
      `Precision is a great strength, and ${name} has it in spades!`,
      `Slow and steady wins the race, and ${name} is building a rock-solid foundation.`
    ],
    [FeedbackCategory.REINFORCEMENT]: [
      `${name} is doing a fantastic job!`,
      `Wonderful effort today from ${name}.`,
      `You can really see the practice paying off for ${name}!`
    ],
    [FeedbackCategory.MASTERY]: [
      `Wow! ${name} is absolutely crushing it!`,
      `Incredible performance! ${name} is ready for new challenges.`,
      `Superb reading! ${name} makes it look easy.`
    ]
  };

  const options = encouragements[category];
  return options[Math.floor(Math.random() * options.length)];
}
