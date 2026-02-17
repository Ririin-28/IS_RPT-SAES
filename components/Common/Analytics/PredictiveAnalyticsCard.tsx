
"use client";

import { useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import { Loader2 } from "lucide-react";

interface PredictiveAnalyticsCardProps {
  studentId: string;
}

export function PredictiveAnalyticsCard({ studentId }: PredictiveAnalyticsCardProps) {
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function runPrediction() {
      if (!studentId) return;
      
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Model Metadata (Normalization Constants)
        const metaRes = await fetch("/models/performance-predictor/meta.json");
        if (!metaRes.ok) throw new Error("Model not initialized (Meta missing)");
        const meta = await metaRes.json();
        
        // 2. Fetch Student Features
        const featuresRes = await fetch(`/api/analytics/features/${studentId}`); 
        if (!featuresRes.ok) {
           if (featuresRes.status === 404) {
             setError("Insufficient Data");
             return;
           }
           throw new Error("Failed to fetch student data");
        }
        const { features } = await featuresRes.json(); // [sessions, phonemic, avgScore]

        // 3. Load Model
        const model = await tf.loadLayersModel("/models/performance-predictor/model.json");
        
        // 4. Preprocess Input
        // Normalize: (val - min) / (max - min)
        const inputTensor = tf.tensor2d([features], [1, 3]);
        const min = tf.tensor(meta.inputMin); 
        const max = tf.tensor(meta.inputMax);
        
        const normalizedInput = inputTensor.sub(min).div(max.sub(min));
        
        // 5. Predict
        const resultTensor = model.predict(normalizedInput) as tf.Tensor;
        const normalizedScore = (await resultTensor.data())[0];
        
        // Denormalize? Model output is 0-1 (if normalized labels) or 0-100?
        // In dataset.ts we did: labelTensor.div(tf.scalar(100)) -> so it's 0-1
        const predictedScore = normalizedScore * 100;
        
        setPrediction(Math.min(100, Math.max(0, predictedScore)));
        
        // Cleanup tensors
        inputTensor.dispose();
        min.dispose();
        max.dispose();
        normalizedInput.dispose();
        resultTensor.dispose(); 

      } catch (err: any) {
        console.error("Prediction Error:", err);
        setError(err.message || "Prediction failed");
      } finally {
        setLoading(false);
      }
    }

    runPrediction();
  }, [studentId]);

  if (error) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 w-full h-[150px] flex items-center justify-center bg-white dark:bg-gray-800">
          <div className="text-sm text-yellow-600 dark:text-yellow-500 text-center">
             <p className="font-semibold mb-1">Analytics Unavailable</p>
             <p className="text-xs opacity-80">{error === "Model not initialized (Meta missing)" ? "System needs simpler training first." : error}</p>
          </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm bg-white dark:bg-gray-800 w-full">
      <div className="flex flex-col space-y-1.5 p-6 pb-2">
        <div className="flex flex-row items-center justify-between space-y-0">
            <h3 className="font-semibold leading-none tracking-tight text-sm">Predicted Next Score</h3>
            {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                    prediction && prediction < 75 
                    ? "border-transparent bg-red-500 text-white hover:bg-red-600" 
                    : "border-transparent bg-green-500 text-white hover:bg-green-600"
                }`}>
                    {prediction && prediction < 75 ? "At Risk" : "On Track"}
                </span>
            )}
        </div>
      </div>
      <div className="p-6 pt-0">
        <div className="text-2xl font-bold">
           {loading || prediction === null ? "--" : `${prediction.toFixed(1)}%`}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
           AI-generated forecast based on recent trends & remedial history.
        </p>
      </div>
    </div>
  );
}

