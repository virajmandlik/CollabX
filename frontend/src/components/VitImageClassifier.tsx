import React, { useState, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';

interface VitClassifierProps {
  onImageClassified: (results: ClassificationResult[]) => void;
  imageData: string;
}

interface ClassificationResult {
  label: string;
  score: number;
}

const VitImageClassifier: React.FC<VitClassifierProps> = ({ onImageClassified, imageData }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    classifyImage();
  }, [imageData]);

  const preprocessImage = async (imageData: string): Promise<tf.Tensor> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const tensor = tf.browser.fromPixels(img)
            .resizeBilinear([224, 224])
            .toFloat()
            .expandDims(0);
          
          const normalized = tensor.div(tf.scalar(127.5)).sub(tf.scalar(1));
          resolve(normalized);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => reject(err);
      img.src = imageData;
    });
  };

  const classifyImage = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load the model
      const model = await tf.loadGraphModel(
        'https://tfhub.dev/google/tfjs-model/vit_b16_224/classification/1/default/1',
        { fromTFHub: true }
      );

      // Preprocess the image
      const tensor = await preprocessImage(imageData);

      // Run inference
      const predictions = await model.predict(tensor) as tf.Tensor;
      const scores = await predictions.data();

      // Get top 5 predictions
      const topK = 5;
      const indices = Array.from(scores)
        .map((score, i) => ({ score, index: i }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      // Convert to classification results
      const results: ClassificationResult[] = indices.map(({ score, index }) => ({
        label: imagenetLabels[index] || `Class ${index}`,
        score: score
      }));

      onImageClassified(results);
    } catch (err) {
      console.error('Classification error:', err);
      setError(err instanceof Error ? err.message : 'Classification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vit-classifier">
      {loading && <div>Analyzing image...</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
};

// ImageNet class labels (abbreviated version)
const imagenetLabels: { [key: number]: string } = {
  0: "tench",
  1: "goldfish",
  2: "great white shark",
  3: "tiger shark",
  4: "hammerhead shark",
  // Add more labels as needed...
};

export default VitImageClassifier;
