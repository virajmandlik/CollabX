import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { IMAGGA_AUTH } from '../lib/env';

interface ImageRecognitionProps {
  imageData: string | null;
  onRecognitionComplete: (categories: Category[]) => void;
}

export interface Category {
  name: string;
  confidence: number;
}

const ImageRecognition: React.FC<ImageRecognitionProps> = ({ imageData, onRecognitionComplete }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset error state when imageData changes (new image selected)
  useEffect(() => {
    setError(null);
  }, [imageData]);

  const analyzeImage = async () => {
    if (!imageData) return;

    setLoading(true);
    setError(null);

    try {
      // Convert base64 image data to a Blob
      const base64Data = imageData.split(',')[1];
      const blob = await fetch(`data:image/jpeg;base64,${base64Data}`).then(res => res.blob());

      const formData = new FormData();
      formData.append('image', blob, 'image.jpg');

      const response = await axios.post('https://api.imagga.com/v2/categories/personal_photos', formData, {
        headers: {
          'Authorization': IMAGGA_AUTH,
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && response.data.result && response.data.result.categories) {
        const categories = response.data.result.categories.map((cat: any) => ({
          name: cat.name.en,
          confidence: cat.confidence
        }));

        // Clear any error before calling onRecognitionComplete
        setError(null);
        onRecognitionComplete(categories);
      } else {
        setError('No categories found in the response');
      }
    } catch (error) {
      console.error('Error recognizing image', error);
      setError('Failed to analyze image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Image Recognition</h3>

    
      <div className="flex justify-center">
        {imageData && (
          <img
            src={imageData}
            alt="Preview"
            className="max-h-48 object-contain mb-4 rounded"
          />
        )}
      </div>

      <Button
        onClick={analyzeImage}
        disabled={!imageData || loading}
        className="w-full bg-white text-black border border-gray-300 hover:bg-gray-100"
      >
        {loading ? 'Analyzing...' : 'Analyze Image'}
      </Button>
    </div>
  );
};

export default ImageRecognition;
