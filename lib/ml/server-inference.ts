
import * as tf from "@tensorflow/tfjs";
import fs from "fs/promises";
import path from "path";

const MODEL_DIR_ABS = path.join(process.cwd(), "public", "models", "performance-predictor");

export async function predictStudentScore(features: number[]): Promise<number | null> {
  try {
    // 1. Load Meta (Min/Max)
    const metaPath = path.join(MODEL_DIR_ABS, "meta.json");
    try {
        await fs.access(metaPath);
    } catch {
        console.warn("Prediction model not initialized (meta.json missing).");
        return null; // Model not trained yet
    }
    
    const metaContent = await fs.readFile(metaPath, "utf-8");
    const meta = JSON.parse(metaContent);

    // 2. Load Model Artifacts
    const modelJsonPath = path.join(MODEL_DIR_ABS, "model.json");
    const weightsPath = path.join(MODEL_DIR_ABS, "weights.bin");

    const modelJson = JSON.parse(await fs.readFile(modelJsonPath, "utf-8"));
    const weightsBuffer = await fs.readFile(weightsPath);
    
    // We need to create a custom IO handler that returns the artifacts directly
    // Wait, tf.io.fromMemory expects the JSON topology/manifest, BUT NOT the raw buffer for weights directly unless using 'weightsManifest' format.
    // If 'modelJson' contains 'weightsManifest', tfjs will try to fetch the weights.
    // Since we are server-side "memory" loading, we need to supply the weight specs.
    
    // The issue is that standard tf.io.fromMemory() expects weight specs inside the modelTopology object,
    // OR we can implement `load()` manually.
    
    // Simpler approach: Use tf.loadLayersModel with a custom IO handler object.
    // We need to extract them from the manifest within modelJson
    const weightSpecs = modelJson.weightsManifest?.[0]?.weights;
    
    // If weightSpecs are missing, we can't load.
    if (!weightSpecs) {
       console.warn("Invalid model.json structure (missing weightsManifest).");
       return null; 
    }

    const handler = tf.io.fromMemory(
        modelJson.modelTopology || modelJson, 
        weightSpecs,
        weightsBuffer.buffer
    );
    
    const model = await tf.loadLayersModel(handler);

    // 3. Preprocess
    // We must tidy to ensure no GPU/backend memory leak (though CPU backend is used in node usually)
    const normalizedScore = tf.tidy(() => {
        const inputTensor = tf.tensor2d([features], [1, 3]);
        const min = tf.tensor(meta.inputMin); 
        const max = tf.tensor(meta.inputMax);
        
        // Ensure shapes match
        // meta.inputMin is [3], inputTensor is [1, 3]. Broadcasting should handle it.
        const normalizedInput = inputTensor.sub(min).div(max.sub(min));
        
        const resultTensor = model.predict(normalizedInput) as tf.Tensor;
        const data = resultTensor.dataSync(); // Sync for simplicity in tidy scope
        return data[0];
    });
    
    model.dispose(); 
    return normalizedScore * 100;

  } catch (error) {
    console.error("Server-side prediction failed:", error);
    return null;
  }
}
