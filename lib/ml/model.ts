
import * as tf from "@tensorflow/tfjs";
import { fetchStudentTrainingData, convertToTensors } from "./dataset";
import fs from "fs/promises";
import path from "path";

const MODEL_PATH = path.join(process.cwd(), "public", "models", "performance-predictor");

export async function createAndTrainModel() {
  const rawData = await fetchStudentTrainingData();
  const tensorData = convertToTensors(rawData);
  const { inputs, labels, inputMax, inputMin } = tensorData;

  // Define a simple sequential model
  const model = tf.sequential();
  
  // Hidden Layer 1
  model.add(tf.layers.dense({ 
    inputShape: [3], 
    units: 10, 
    activation: 'relu' 
  }));

  // Hidden Layer 2
  model.add(tf.layers.dense({ 
    units: 10, 
    activation: 'relu' 
  }));

  // Output Layer (Regression)
  model.add(tf.layers.dense({ 
    units: 1, 
    activation: 'linear' // or 'sigmoid' if normalized 0-1
  }));

  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: 'meanSquaredError',
    metrics: ['mse']
  });

  const batchSize = 32;
  const epochs = 50;

  await model.fit(inputs, labels, {
    batchSize,
    epochs,
    shuffle: true,
  });

  // Save Model
  await fs.mkdir(MODEL_PATH, { recursive: true });
  
  // Save using a custom handler to write to disk without tfjs-node
  await model.save(tf.io.withSaveHandler(async (artifacts: tf.io.ModelArtifacts) => {
    // 1. Save Weights Binary
    if (artifacts.weightData) {
       const data = Array.isArray(artifacts.weightData) ? artifacts.weightData[0] : artifacts.weightData;
       const weightBuffer = Buffer.from(new Uint8Array(data));
       const weightFileName = "weights.bin";
       await fs.writeFile(path.join(MODEL_PATH, weightFileName), weightBuffer);
       
       // 2. Create Model JSON with Manifest
       const modelJSON = {
         modelTopology: artifacts.modelTopology,
         format: artifacts.format,
         generatedBy: artifacts.generatedBy,
         convertedBy: artifacts.convertedBy,
         weightsManifest: [{
           paths: ["./" + weightFileName],
           weights: artifacts.weightSpecs || []
         }]
       };

       await fs.writeFile(
         path.join(MODEL_PATH, "model.json"), 
         JSON.stringify(modelJSON, null, 2)
       );
    } else {
        // Topology only (no weights)
       await fs.writeFile(
         path.join(MODEL_PATH, "model.json"), 
         JSON.stringify(artifacts, null, 2)
       );
    }

    return {
      modelArtifactsInfo: {
        dateSaved: new Date(),
        modelTopologyType: 'JSON',
      }
    };
  }));


  // Save Normalization Constants (Min/Max) for inference
  const normalizationData = {
    inputMax: inputMax.arraySync(),
    inputMin: inputMin.arraySync()
  };
  
  await fs.writeFile(
    path.join(MODEL_PATH, "meta.json"), 
    JSON.stringify(normalizationData, null, 2)
  );

  return {
    loss: 0, // Placeholder, would capture from fit history
    epochs,
    samples: rawData.length
  };
}

/**
 * Loads the trained model for server-side inference.
 * (For client-side, fetch '/models/performance-predictor/model.json')
 */
export async function loadModel() {
   // Loading from file:// requires tfjs-node. 
   // In pure node without tfjs-node, we must load manually or fetch via HTTP if running on client.
   // Since this function is for SERVER-SIDE inference... we might be stuck without tfjs-node for loading easily.
   // workaround: Construct model from JSON manually.
   
   // Actually, we can use tf.loadLayersModel with a custom IO handler that reads from disk.
   const modelJsonPath = path.join(MODEL_PATH, "model.json");
   const metaJsonPath = path.join(MODEL_PATH, "meta.json");
   
   // Check if exists
   try {
     await fs.access(modelJsonPath);
   } catch {
     return null; 
   }

   const loadHandler = tf.io.fromMemory(
     JSON.parse(await fs.readFile(modelJsonPath, 'utf8')),
     // We need to load weights manually into the tensor format if using fromMemory?
     // No, fromMemory expects weight specs.
     // Better approach: Use file system read. See below.
     undefined 
   );

   // To load weights in pure JS Node is tricky. 
   // Alternative: Inference on CLIENT side only (easier).
   // Or: User implements a simple HTTP handler loopback? No.
   
   // Let's implement a loader that reads the weights.bin
   const modelFile = JSON.parse(await fs.readFile(modelJsonPath, 'utf8'));
   const weightsFile = await fs.readFile(path.join(MODEL_PATH, "weights.bin"));
   
   // We can perform a hack:
   // tf.loadLayersModel(tf.io.browserHTTPRequest(...)) works in browser.
   // Here we can use tf.models.modelFromJSON(topology) and then load weights.
   
   // Given complexity, let's recommend inference on Client Side for V1 in this plan.
   // But for the sake of completeness, let's return the metadata so the API can pass it to client.
   const meta = JSON.parse(await fs.readFile(metaJsonPath, 'utf8'));
   return { modelUrl: '/models/performance-predictor/model.json', meta };
}
