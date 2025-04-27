import React, { useState } from "react";
import axios from "axios";
import { Button, Form, Card, ProgressBar, Alert } from "react-bootstrap";

export interface ClassificationResult {
  label: string;
  score: number;
  confidence?: number; // Added to handle different API response formats
}

interface ImageClassifierProps {
  onImageClassified?: (imageData: string, results: ClassificationResult[]) => void;
}

const ImageClassifier: React.FC<ImageClassifierProps> = ({ onImageClassified }) => {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [results, setResults] = useState<ClassificationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = '/classify-image'; // This will be proxied through Vite to backend
  const HUGGING_FACE_TOKEN = import.meta.env.VITE_HUGGINGFACE_TOKEN;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setImage(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      setResults([]);
      setError(null);
    }
  };

  const classifyImage = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', image);

      const response = await axios.post(API_URL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`
        }
      });

      if (response.data) {
        const formattedResults = Array.isArray(response.data) 
          ? response.data
          : [response.data];

        const processedResults = formattedResults.map((item: any) => ({
          label: item.label || item.category || '',
          score: (item.score || item.confidence || 0) * 100
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Get top 5 results

        setResults(processedResults);
        
        if (onImageClassified && imagePreview) {
          onImageClassified(imagePreview, processedResults);
        }
      }
    } catch (error: any) {
      console.error("Classification error:", error);
      setError(error.response?.data?.error || "Failed to classify image");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="image-classifier">
      <input
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="file-input"
      />
      
      {imagePreview && (
        <div className="preview-container">
          <img src={imagePreview} alt="Preview" className="image-preview" />
        </div>
      )}
      
      <Button 
        onClick={classifyImage} 
        disabled={!image || loading}
        className="classify-button"
      >
        {loading ? 'Classifying...' : 'Classify Image'}
      </Button>

      {error && <div className="error-message">{error}</div>}
      
      {results.length > 0 && (
        <div className="results-container">
          <h3>Classification Results:</h3>
          <ul>
            {results.map((result, index) => (
              <li key={index}>
                {result.label}: {result.score.toFixed(2)}%
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ImageClassifier; 
