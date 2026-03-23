
import * as tf from "@tensorflow/tfjs";

// 1. Define Tutor Feedback Categories (Classes)
export enum TutorFeedbackCategory {
  IMMEDIATE_RETRY = 0,     // Very poor accuracy/speed
  SLOW_DOWN = 1,           // Good accuracy, too fast (rushing)
  SPEED_UP = 2,            // Good accuracy, too slow (robot reading)
  PRONUNCIATION_FIX = 3,   // Good speed, specific pronunciation errors
  PERFECT_FLOW = 4         // Excellent performance
}

const lastTutorTemplateByKey = new Map<string, number>();

// 2. Synthetic Data Generator
// Create ground truth data based on expert heuristics for immediate feedback
function generateTutorTrainingData(samplesPerClass = 200) {
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
    // Class 0: Immediate Retry (Acc < 0.6)
    addSample(0.4 + Math.random() * 0.2, 0.2 + Math.random() * 0.3, 0.4 + Math.random() * 0.2, TutorFeedbackCategory.IMMEDIATE_RETRY);

    // Class 1: Slow Down (Acc < 0.8, Speed > 0.8) - Rushing
    addSample(0.7 + Math.random() * 0.1, 0.85 + Math.random() * 0.15, 0.75 + Math.random() * 0.1, TutorFeedbackCategory.SLOW_DOWN);

    // Class 2: Speed Up (Acc > 0.85, Speed < 0.4) - Robot Reading
    addSample(0.9 + Math.random() * 0.1, 0.2 + Math.random() * 0.2, 0.7 + Math.random() * 0.2, TutorFeedbackCategory.SPEED_UP);

    // Class 3: Pronunciation Fix (Acc 0.7-0.9, Speed 0.4-0.8)
    addSample(0.8 + Math.random() * 0.1, 0.6 + Math.random() * 0.2, 0.8 + Math.random() * 0.1, TutorFeedbackCategory.PRONUNCIATION_FIX);

    // Class 4: Perfect Flow (Acc > 0.9, Speed > 0.6)
    addSample(0.95 + Math.random() * 0.05, 0.7 + Math.random() * 0.3, 0.95 + Math.random() * 0.05, TutorFeedbackCategory.PERFECT_FLOW);
  }

  return { inputs, labels };
}

// 3. Model Cache
declare global {
  var __tutorModel: tf.LayersModel | null | undefined;
}

let isTraining = false;

// 4. Train Model (Singleton)
export async function getTutorModel() {
  if (globalThis.__tutorModel) return globalThis.__tutorModel;
  
  if (isTraining) {
    while (isTraining) await new Promise(r => setTimeout(r, 100));
    if (globalThis.__tutorModel) return globalThis.__tutorModel;
  }

  isTraining = true;
  try {
    const model = tf.sequential();
    const modelId = Date.now().toString();
    
    // Input Layer: 3 features [Accuracy, NormalizedSpeed, SlideAverage]
    model.add(tf.layers.dense({ 
      units: 16, 
      activation: 'relu', 
      inputShape: [3], 
      name: `tutor_dense_${modelId}_1` 
    }));
    
    // Hidden Layer
    model.add(tf.layers.dense({ 
      units: 12, 
      activation: 'relu', 
      name: `tutor_dense_${modelId}_2` 
    }));
    
    // Output Layer: 5 classes (Softmax)
    model.add(tf.layers.dense({ 
      units: 5, 
      activation: 'softmax', 
      name: `tutor_dense_${modelId}_3` 
    }));

    model.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'sparseCategoricalCrossentropy',
      metrics: ['accuracy']
    });

    const { inputs, labels } = generateTutorTrainingData();
    const xs = tf.tensor2d(inputs);
    const ys = tf.tensor1d(labels);

    await model.fit(xs, ys, {
      epochs: 25, // Slightly more epochs for finer distinctions
      batchSize: 32,
      shuffle: true,
      verbose: 0
    });

    xs.dispose();
    ys.dispose();
    
    globalThis.__tutorModel = model;
    return model;
  } finally {
    isTraining = false;
  }
}

// 5. Prediction Function
export async function predictTutorAction(
  accuracy: number, // 0-100
  wpm: number,      // 0-150+
  average: number   // 0-100
): Promise<TutorFeedbackCategory> {
  const model = await getTutorModel();
  
  return tf.tidy(() => {
    // Normalize Inputs
    const normAcc = Math.max(0, Math.min(1, accuracy / 100));
    const normWpm = Math.max(0, Math.min(1, wpm / 150)); 
    const normAvg = Math.max(0, Math.min(1, average / 100));

    const input = tf.tensor2d([[normAcc, normWpm, normAvg]]);
    const prediction = model.predict(input) as tf.Tensor;
    const classIndex = prediction.argMax(1).dataSync()[0];
    
    return classIndex as TutorFeedbackCategory;
  });
}

// 6. Dynamic Template System
export function getTutorTemplate(category: TutorFeedbackCategory, studentName: string): string {
  const name = studentName || "Student";
  
  const templates: Record<TutorFeedbackCategory, string[]> = {
    [TutorFeedbackCategory.IMMEDIATE_RETRY]: [
      `Let's try that one again, ${name}. Take a deep breath and look at the words carefully.`,
      `Not quite there yet, ${name}. Listen to me read it first, then you try.`,
      `We can do better, ${name}. Let's focus on the first few words and try again.`
    ],
    [TutorFeedbackCategory.SLOW_DOWN]: [
      `Whoa there, ${name}! You're fast, but let's make sure every word is clear.`,
      `Slow down a little, ${name}. Reading isn't a race—let's get every sound right.`,
      `Great energy, ${name}, but try to pause at the commas and periods.`
    ],
    [TutorFeedbackCategory.SPEED_UP]: [
      `That was correct, ${name}. Now let's try to say it a bit smoother, like talking to a friend.`,
      `Good reading, ${name}. Try to connect the words together so it flows better.`,
      `You got the words right, ${name}. Now let's pick up the pace just a little bit.`
    ],
    [TutorFeedbackCategory.PRONUNCIATION_FIX]: [
      `Nice effort, ${name}. Just watch out for those tricky words we missed.`,
      `Almost perfect, ${name}. Let's polish those few sounds to make it shine.`,
      `You're getting it, ${name}. A quick review of the hard words and you'll be set.`
    ],
    [TutorFeedbackCategory.PERFECT_FLOW]: [
      `Outstanding, ${name}! That sounded just like a storyteller.`,
      `Perfect! ${name} is ready for the next challenge.`,
      `Beautiful reading, ${name}. Smooth, clear, and correct!`
    ]
  };

  const options = templates[category];
  if (!options.length) return `Good effort, ${name}. Keep practicing and try the next one.`;

  const key = `${category}:${name.toLowerCase()}`;
  let selectedIndex = Math.floor(Math.random() * options.length);
  const previousIndex = lastTutorTemplateByKey.get(key);

  if (typeof previousIndex === "number" && selectedIndex === previousIndex && options.length > 1) {
    selectedIndex = (selectedIndex + 1) % options.length;
  }

  lastTutorTemplateByKey.set(key, selectedIndex);
  return options[selectedIndex];
}
