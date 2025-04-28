import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Image as KonvaImage } from 'react-konva';
import { useParams, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import keycloak from '../keycloak';
import ChatPanel from './ChatPanel';
import CollaboratorInvite from './CollaboratorInvite';
import { Socket } from 'socket.io-client';
import { createAuthenticatedSocket } from '../lib/socketUtils';
import { KonvaEventObject } from 'konva/lib/Node';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Pencil, Eraser, Trash2, Upload, Download, FileDown, ArrowLeft, Image, X, Search, Undo2, Redo2 } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import CursorLayer from './CursorLayer';
import { cn } from '../lib/utils';
import VitImageClassifier from './VitImageClassifier';
import ImageRecognition, { Category } from './ImageRecognition';
import { Modal, ModalBody, ModalHeader, ModalTitle } from 'react-bootstrap';

interface LineProps {
  tool: string;
  points: number[];
  color: string;
  strokeWidth: number;
}

interface ImageProps {
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
}

interface ActiveUser {
  userId: string;
  username: string;
}

// Add new interface for classification result
interface ClassifiedImageProps extends ImageProps {
  classification?: ClassificationResult[];
  recognition?: Category[];
}

interface ClassificationResult {
  label: string;
  score: number;
}

interface EmojiProps extends ImageProps {
  text: string;
}

const WhiteboardCanvas = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const stageRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [lines, setLines] = useState<LineProps[]>([]);
  const [images, setImages] = useState<ClassifiedImageProps[]>([]);
  const [color, setColor] = useState<string>('#000000');
  const [strokeWidth, setStrokeWidth] = useState<number>(5);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCreator, setIsCreator] = useState<boolean>(false);
  const [boardTitle, setBoardTitle] = useState<string>('Whiteboard');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth * 0.9, height: window.innerHeight * 0.7 });
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleTimeString());
  const [emojis, setEmojis] = useState<EmojiProps[]>([]);
  const [showEmojiPalette, setShowEmojiPalette] = useState<boolean>(false);

  // Available emojis for the palette
  const availableEmojis = [
    "😀", "😂", "🥰", "😎", "🤔", "👍", "👎", "❤️", "🔥", "⭐",
    "🎉", "🎁", "🚀", "💯", "🏆", "🌈", "🍕", "🍦", "🎮", "📱"
  ];

  // New state for image classification
  const [showClassifier, setShowClassifier] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<ClassifiedImageProps | null>(null);
  const [classifierModal, setClassifierModal] = useState<boolean>(false);

  // New state for image recognition
  const [recognitionModal, setRecognitionModal] = useState<boolean>(false);
  const [recognizedCategories, setRecognizedCategories] = useState<Category[]>([]);

  // History state for undo/redo functionality
  interface HistoryState {
    lines: LineProps[];
    images: ClassifiedImageProps[];
    emojis: EmojiProps[];
  }
  const [history, setHistory] = useState<HistoryState[]>([{ lines: [], images: [], emojis: [] }]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Initialize socket connection
  useEffect(() => {
    if (!id) return;

    const initSocket = async () => {
      try {
        const socketInstance = await createAuthenticatedSocket();
        console.log('Socket connected:', socketInstance.connected);
        setSocket(socketInstance);

        socketInstance.on('connect', () => {
          console.log('Socket connection established');
        });

        socketInstance.on('disconnect', () => {
          console.log('Socket disconnected');
        });

        socketInstance.emit('join-room', id);

        // Listen for active users
        socketInstance.on('user-joined', (data) => {
          console.log('User joined:', data);
          setActiveUsers(prevUsers => {
            // Only add if not already in the list
            if (!prevUsers.some(user => user.userId === data.userId)) {
              return [...prevUsers, { userId: data.userId, username: data.username }];
            }
            return prevUsers;
          });
        });

        // Listen for user left events
        socketInstance.on('user-left', (data) => {
          console.log('User left:', data);
          setActiveUsers(prevUsers =>
            prevUsers.filter(user => user.userId !== data.userId)
          );
        });

        socketInstance.on('room-info', (data) => {
          console.log('Room info received:', data);
        });

        // Listen for draw events from other users
        socketInstance.on('draw', (data) => {
          console.log('Received drawing update:', data);
          setLines(prevLines => {
            // Find the line with the matching lineId or add a new one
            const newLines = [...prevLines];
            if (data.isNewLine) {
              newLines.push(data.line);
            } else {
              // Update existing line
              const index = newLines.findIndex(line =>
                line.points[0] === data.line.points[0] &&
                line.points[1] === data.line.points[1]
              );
              if (index !== -1) {
                newLines[index] = data.line;
              }
            }
            return newLines;
          });
        });

        // Listen for image added by other users
        socketInstance.on('add-image', (data) => {
          console.log('Received image data:', {
            imageSize: data.image.src.length,
            hasClassification: !!data.image.classification,
            userId: data.userId
          });

          setImages(prevImages => {
            const newImage = {
              src: data.image.src,
              x: data.image.x,
              y: data.image.y,
              width: data.image.width,
              height: data.image.height,
              classification: Array.isArray(data.image.classification)
                ? data.image.classification
                : []
            };

            return [...prevImages, newImage];
          });
        });

        socketInstance.on('update-image', (data) => {
          const { imageIndex, newPosition } = data;
          setImages(prevImages => {
            const newImages = [...prevImages];
            if (newImages[imageIndex]) {
              newImages[imageIndex] = {
                ...newImages[imageIndex],
                x: newPosition.x,
                y: newPosition.y
              };
            }
            return newImages;
          });
        });

        // Listen for emoji added by other users
        socketInstance.on('add-emoji', (data) => {
          console.log('Received emoji data:', data);

          setEmojis(prevEmojis => {
            const newEmoji = {
              text: data.emoji.text,
              src: data.emoji.src,
              x: data.emoji.x,
              y: data.emoji.y,
              width: data.emoji.width,
              height: data.emoji.height
            };

            return [...prevEmojis, newEmoji];
          });
        });

        // Listen for emoji position updates
        socketInstance.on('update-emoji', (data) => {
          const { emojiIndex, newPosition } = data;
          setEmojis(prevEmojis => {
            const newEmojis = [...prevEmojis];
            if (newEmojis[emojiIndex]) {
              newEmojis[emojiIndex] = {
                ...newEmojis[emojiIndex],
                x: newPosition.x,
                y: newPosition.y
              };
            }
            return newEmojis;
          });
        });

        return () => {
          socketInstance.disconnect();
        };
      } catch (error) {
        console.error('Socket initialization error:', error);
      }
    };

    initSocket();
  }, [id]);

  // Listen for window resize to adjust stage size
  useEffect(() => {
    const handleResize = () => {
      setStageSize({
        width: window.innerWidth * 0.9,
        height: window.innerHeight * 0.7
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Fetch whiteboard data
  useEffect(() => {
    if (!id) return;

    const username = keycloak.tokenParsed?.preferred_username;
    console.log("Current user:", username);

    // Check if we are the creator and get whiteboard data
    const fetchWhiteboard = async () => {
      try {
        const token = keycloak.token;
        if (!token) return;

        console.log("Fetching whiteboard data...");
        const res = await fetch(`http://localhost:4000/whiteboards/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          console.log("Whiteboard data:", data);

          setBoardTitle(data.title || 'Whiteboard');

          // Check if user is the creator
          if (data.created_by === username) {
            console.log("User is the creator!");
            setIsCreator(true);
          }

          if (data.content && data.content.elements && Array.isArray(data.content.elements)) {
            setLines(data.content.elements);
          }

          if (data.content && data.content.images && Array.isArray(data.content.images)) {
            setImages(data.content.images);
          }

          setLoading(false);

          // Initialize history with the loaded state
          setTimeout(() => {
            setHistory([{
              lines: data.content?.elements || [],
              images: data.content?.images || [],
              emojis: []
            }]);
            setHistoryIndex(0);
          }, 100);
        } else if (res.status === 403) {
          console.error("No access permission");
          alert('You do not have access to this whiteboard');
          navigate('/');
        } else {
          console.error("Failed to fetch whiteboard:", await res.text());
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching whiteboard:", err);
        setLoading(false);
      }
    };

    fetchWhiteboard();
  }, [id, navigate]);

  // Function to save current state to history
  const saveToHistory = () => {
    // Create a new history array by removing any future states (if we've gone back in time)
    const newHistory = history.slice(0, historyIndex + 1);

    // Add current state to history
    newHistory.push({
      lines: [...lines],
      images: [...images],
      emojis: [...emojis]
    });

    // Update history and move index to the end
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo function
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const previousState = history[newIndex];

      // Restore previous state
      setLines(previousState.lines);
      setImages(previousState.images);
      setEmojis(previousState.emojis);

      // Update history index
      setHistoryIndex(newIndex);
    }
  };

  // Redo function
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextState = history[newIndex];

      // Restore next state
      setLines(nextState.lines);
      setImages(nextState.images);
      setEmojis(nextState.emojis);

      // Update history index
      setHistoryIndex(newIndex);
    }
  };

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    // Get pointer position from stage
    const stage = stageRef.current;
    if (!stage) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    // Check if within boundaries
    if (pointerPos.x < 0 || pointerPos.y < 0 ||
        pointerPos.x > stage.width() || pointerPos.y > stage.height()) {
      return;
    }

    setIsDrawing(true);

    const newLines = [...lines];
    const newLine = {
      tool,
      points: [pointerPos.x, pointerPos.y],
      color: color,
      strokeWidth: strokeWidth,
    };
    newLines.push(newLine);

    setLines(newLines);

    // Send to server
    if (socket && socket.connected) {
      socket.emit('draw', {
        roomId: id,
        line: newLine,
        isNewLine: true
      });
    }
  };

  // Track the last time we sent a cursor position update
  const lastCursorUpdateRef = useRef<number>(0);

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    // Check if within boundaries
    if (pointerPos.x < 0 || pointerPos.y < 0 ||
        pointerPos.x > stage.width() || pointerPos.y > stage.height()) {
      // Instead of stopping drawing, just don't add the point outside boundaries
      return;
    }

    // Emit cursor position to other users (throttled to every 50ms)
    const now = Date.now();
    if (socket && socket.connected && now - lastCursorUpdateRef.current > 50) {
      socket.emit('cursor-move', {
        roomId: id,
        position: pointerPos,
        // Generate a consistent color based on username
        color: stringToColor(keycloak.tokenParsed?.preferred_username || 'user'),
        username: keycloak.tokenParsed?.preferred_username || 'user'
      });
      lastCursorUpdateRef.current = now;
    }

    // Only continue with drawing if we're in drawing mode
    if (!isDrawing) return;

    const newLines = [...lines];
    const lastLine = newLines[newLines.length - 1];

    // Add point to the last line
    lastLine.points = lastLine.points.concat([pointerPos.x, pointerPos.y]);
    setLines(newLines);

    // Send to server
    if (socket && socket.connected) {
      socket.emit('draw', {
        roomId: id,
        line: lastLine,
        isNewLine: false
      });
    }
  };

  // Helper function to generate a color from a string (username)
  const stringToColor = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xFF;
      color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      // Save state to history when drawing is complete
      saveToHistory();
    }
  };

  const clearCanvas = () => {
    // Save current state to history before clearing
    saveToHistory();

    // Clear canvas
    setLines([]);
    setImages([]);
    setEmojis([]);

    // Save the cleared state to history
    setTimeout(() => saveToHistory(), 0);
  };

  const exportAsImage = () => {
    if (!stageRef.current) return;

    const uri = stageRef.current.toDataURL();
    const link = document.createElement('a');
    link.download = `${boardTitle.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAsPDF = () => {
    if (!stageRef.current) return;

    const uri = stageRef.current.toDataURL();
    const pdf = new jsPDF();

    // Calculate aspect ratio
    const imgWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (stageSize.height * imgWidth) / stageSize.width;

    pdf.addImage(uri, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`${boardTitle.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  const handleImageUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const showImageClassifierModal = () => {
    setClassifierModal(true);
  };

  const showImageRecognitionModal = () => {
    setRecognitionModal(true);
  };

  const handleRecognitionComplete = (categories: Category[]) => {
    setRecognizedCategories(categories);

    // Add the categories to the image if it exists
    if (selectedImage) {
      const imageWithRecognition: ClassifiedImageProps = {
        ...selectedImage,
        recognition: categories
      };

      addImageToCanvas(imageWithRecognition);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      if (!event.target?.result) return;

      const imageData = event.target.result as string;
      setSelectedImage(imageData);

      // Reset recognized categories when selecting a new image
      setRecognizedCategories([]);

      // Show options modal for what to do with the image
      const shouldRecognize = window.confirm("Would you like to recognize this image? Click OK for recognition or Cancel to add directly.");

      if (shouldRecognize) {
        setRecognitionModal(true);
      } else if (showClassifier) {
        setClassifierModal(true);
      } else {
        addImageToCanvas({
          src: imageData,
          width: 300,
          height: 300,
          x: 100,
          y: 100
        });
      }
    };

    reader.readAsDataURL(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClassificationResults = (results: ClassificationResult[]) => {
    if (selectedImage) {
      addImageToCanvas({
        src: selectedImage,
        width: 300,
        height: 300,
        x: 100,
        y: 100,
        classification: results
      });
      setClassifierModal(false);
      setSelectedImage(null);
    }
  };

  // Extracted function to add image to canvas
  const addImageToCanvas = (newImage: ClassifiedImageProps) => {
    // Save current state to history before adding image
    saveToHistory();

    console.log('Adding image to canvas:', {
      hasClassification: !!newImage.classification,
      imageSize: newImage.src.length
    });

    const imageToAdd = {
      src: newImage.src,
      x: newImage.x || 100,
      y: newImage.y || 100,
      width: newImage.width || 300,
      height: newImage.height || 300,
      classification: Array.isArray(newImage.classification)
        ? newImage.classification
        : [],
      recognition: Array.isArray(newImage.recognition)
        ? newImage.recognition
        : []
    };

    setImages(prevImages => [...prevImages, imageToAdd]);

    // Emit to other users if socket exists
    if (socket && socket.connected && id) {
      console.log('Emitting add-image event');
      socket.emit('add-image', {
        roomId: id,
        image: imageToAdd
      });
    } else {
      console.warn('Socket not available for image sharing');
    }

    // Save state to history after adding image
    setTimeout(() => saveToHistory(), 0);
  };

  // Function to add emoji to canvas
  const addEmojiToCanvas = (emoji: string, x: number = 100, y: number = 100) => {
    // Save current state to history before adding emoji
    saveToHistory();

    // Create a canvas to render the emoji
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 50;
    canvas.height = 50;

    if (context) {
      context.font = '30px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(emoji, 25, 25);

      const emojiDataUrl = canvas.toDataURL();

      const emojiToAdd: EmojiProps = {
        text: emoji,
        src: emojiDataUrl,
        x: x,
        y: y,
        width: 50,
        height: 50
      };

      setEmojis(prevEmojis => [...prevEmojis, emojiToAdd]);

      // Emit to other users if socket exists
      if (socket && socket.connected && id) {
        socket.emit('add-emoji', {
          roomId: id,
          emoji: emojiToAdd
        });
      }

      // Save state to history after adding emoji
      setTimeout(() => saveToHistory(), 0);
    }
  };

  // Handle emoji drag start
  const handleEmojiDragStart = (e: React.DragEvent, emoji: string) => {
    e.dataTransfer.setData('text/plain', emoji);
  };

  // Handle emoji drop on canvas
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const emoji = e.dataTransfer.getData('text/plain');

    // Get drop coordinates relative to the canvas
    const stage = stageRef.current;
    if (!stage) return;

    const stageRect = stage.container().getBoundingClientRect();
    const x = e.clientX - stageRect.left;
    const y = e.clientY - stageRect.top;

    // Add emoji at drop position
    addEmojiToCanvas(emoji, x, y);
  };

  // Handle drag over to allow drop
  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Add global event listeners for mouse up and touch end
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDrawing) {
        setIsDrawing(false);
      }
    };

    // Add event listeners to document
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchend', handleGlobalMouseUp);

    // Clean up
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [isDrawing]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="text-lg text-muted-foreground">Loading whiteboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container p-4 mx-auto space-y-6">
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CardTitle className="text-2xl font-bold">{boardTitle}</CardTitle>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isCreator ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                {isCreator ? 'Owner' : 'Collaborator'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg shadow-md font-mono text-lg">
                {currentTime}
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/')} className="flex items-center gap-1 bg-white text-black border border-gray-300 hover:bg-gray-100">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Active Users Section */}
      <Card className="bg-card/50 border-none shadow-sm">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium mb-2">Active Users</h3>
          <div className="flex flex-wrap gap-2">
            {activeUsers.length > 0 ? (
              activeUsers.map((user) => (
                <span
                  key={user.userId}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  title={user.username}
                >
                  {user.username}
                </span>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No other users currently active</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tools Section */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex space-x-2">
          <Button
            variant={tool === 'pen' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool('pen')}
            className="flex items-center gap-1 bg-white text-black border border-gray-300 hover:bg-gray-100"
          >
            <Pencil className="h-4 w-4" />
            Pen
          </Button>
          <Button
            variant={tool === 'eraser' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool('eraser')}
            className="flex items-center gap-1 bg-white text-black border border-gray-300 hover:bg-gray-100"
          >
            <Eraser className="h-4 w-4" />
            Eraser
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={clearCanvas}
            className="flex items-center gap-1 bg-white text-black border border-gray-300 hover:bg-gray-100"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="flex items-center gap-1 bg-white text-black border border-gray-300 hover:bg-gray-100"
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="flex items-center gap-1 bg-white text-black border border-gray-300 hover:bg-gray-100"
          >
            <Redo2 className="h-4 w-4" />
            Redo
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Color:</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 p-0 border rounded cursor-pointer"
          />
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Size:</label>
          <div className="relative w-32">
            <input
              type="range"
              min="1"
              max="50"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
              className="w-full h-3 bg-gradient-to-r from-blue-300 to-blue-600 rounded-lg appearance-none cursor-pointer"
              style={{
                WebkitAppearance: 'none',
                appearance: 'none',
              }}
            />
            <div
              className="absolute -top-6 text-xs font-semibold bg-blue-500 text-white px-2 py-1 rounded-md transform -translate-x-1/2"
              style={{
                left: `${(strokeWidth - 1) / 49 * 100}%`,
                transition: 'left 0.1s ease-out'
              }}
            >
              {strokeWidth}
            </div>
            <style jsx>{`
              input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: white;
                border: 2px solid #3b82f6;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              }
              input[type=range]::-moz-range-thumb {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: white;
                border: 2px solid #3b82f6;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              }
            `}</style>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleImageUploadClick}
          className="flex items-center gap-1 bg-white text-black border border-gray-300 hover:bg-gray-100"
        >
          <Upload className="h-4 w-4" />
          Add Image
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (selectedImage) {
              // Reset recognized categories when opening the modal
              setRecognizedCategories([]);
              setRecognitionModal(true);
            } else {
              alert("Please upload an image first");
              handleImageUploadClick();
            }
          }}
          className="flex items-center gap-1 bg-white text-black border border-gray-300 hover:bg-gray-100"
        >
          <Search className="h-4 w-4" />
          Recognize Image
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowEmojiPalette(!showEmojiPalette)}
          className="flex items-center gap-1 bg-white text-black border border-gray-300 hover:bg-gray-100"
        >
          <span className="mr-1">😀</span>
          Emojis
        </Button>

        {showEmojiPalette && (
          <div className="absolute z-10 mt-2 p-2 bg-white rounded-lg shadow-lg border border-gray-200" style={{ top: '100%' }}>
            <div className="grid grid-cols-5 gap-2">
              {availableEmojis.map((emoji, index) => (
                <div
                  key={index}
                  className="w-10 h-10 flex items-center justify-center text-2xl cursor-grab hover:bg-gray-100 rounded"
                  draggable
                  onDragStart={(e) => handleEmojiDragStart(e, emoji)}
                  onClick={() => {
                    addEmojiToCanvas(emoji);
                    setShowEmojiPalette(false);
                  }}
                >
                  {emoji}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex ml-auto space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportAsImage}
            className="flex items-center gap-1 bg-white text-black border border-gray-300 hover:bg-gray-100"
          >
            <Download className="h-4 w-4" />
            Export PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportAsPDF}
            className="flex items-center gap-1 bg-white text-black border border-gray-300 hover:bg-gray-100"
          >
            <FileDown className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-9">
          <Card className="overflow-hidden border-none shadow-md">
            <div
              className="bg-white rounded-lg relative"
              style={{
                border: '1px solid var(--text-primary)',
                padding: '2px',
                boxShadow: '0 0 0 1px var(--text-primary)'
              }}
              onDrop={handleCanvasDrop}
              onDragOver={handleCanvasDragOver}
            >
              {/* Cursor Layer for showing other users' cursors */}
              <CursorLayer
                socket={socket}
                roomId={id}
                stageWidth={stageSize.width}
                stageHeight={stageSize.height}
              />

              <Stage
                width={stageSize.width}
                height={stageSize.height}
                onMouseDown={handleMouseDown}
                onMousemove={handleMouseMove}
                onMouseup={handleMouseUp}
                onMouseleave={handleMouseUp}
                ref={stageRef}
                style={{
                  backgroundColor: 'white',
                  cursor: 'crosshair',
                  touchAction: 'none',
                  display: 'block',
                  borderRadius: '8px',
                  border: '1px solid var(--text-primary)'
                }}
              >
                <Layer>
                  {images.map((img, i) => (
                    <KonvaImage
                      key={`img-${i}`}
                      x={img.x}
                      y={img.y}
                      width={img.width}
                      height={img.height}
                      image={(() => {
                        const imgElement = new window.Image();
                        imgElement.src = img.src;
                        return imgElement;
                      })()}
                      draggable={true}
                      onDragStart={() => {
                        // Save state before dragging
                        saveToHistory();
                      }}
                      onDragEnd={(e) => {
                        // Update image position in state
                        const newImages = [...images];
                        newImages[i] = {
                          ...img,
                          x: e.target.x(),
                          y: e.target.y()
                        };
                        setImages(newImages);

                        // Emit position update to other users
                        if (socket && id) {
                          socket.emit('update-image', {
                            roomId: id,
                            imageIndex: i,
                            newPosition: {
                              x: e.target.x(),
                              y: e.target.y()
                            }
                          });
                        }

                        // Save state after dragging
                        setTimeout(() => saveToHistory(), 0);
                      }}
                    />
                  ))}

                  {/* Render emojis */}
                  {emojis.map((emoji, i) => (
                    <KonvaImage
                      key={`emoji-${i}`}
                      x={emoji.x}
                      y={emoji.y}
                      width={emoji.width}
                      height={emoji.height}
                      image={(() => {
                        const imgElement = new window.Image();
                        imgElement.src = emoji.src;
                        return imgElement;
                      })()}
                      draggable={true}
                      onDragStart={() => {
                        // Save state before dragging
                        saveToHistory();
                      }}
                      onDragEnd={(e) => {
                        // Update emoji position in state
                        const newEmojis = [...emojis];
                        newEmojis[i] = {
                          ...emoji,
                          x: e.target.x(),
                          y: e.target.y()
                        };
                        setEmojis(newEmojis);

                        // Emit position update to other users
                        if (socket && id) {
                          socket.emit('update-emoji', {
                            roomId: id,
                            emojiIndex: i,
                            newPosition: {
                              x: e.target.x(),
                              y: e.target.y()
                            }
                          });
                        }

                        // Save state after dragging
                        setTimeout(() => saveToHistory(), 0);
                      }}
                    />
                  ))}

                  {lines.map((line, i) => (
                    <Line
                      key={i}
                      points={line.points}
                      stroke={line.color}
                      strokeWidth={line.strokeWidth}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                      globalCompositeOperation={
                        line.tool === 'eraser' ? 'destination-out' : 'source-over'
                      }
                    />
                  ))}
                </Layer>
              </Stage>
            </div>
          </Card>
        </div>

        <div className="col-span-3">
          <Card className="h-full border-none shadow-sm">
            <CardContent className="p-4">
              {isCreator && (
                <CollaboratorInvite whiteboardId={id} />
              )}

              {/* Show classified images with predictions */}
              {images.some(img => Array.isArray(img.classification) && img.classification.length > 0) && (
                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-2">Classified Images</h3>
                  <div className="space-y-4">
                    {images
                      .filter(img => Array.isArray(img.classification) && img.classification.length > 0)
                      .map((img, i) => (
                        <div key={`class-${i}`} className="border rounded p-3">
                          <div className="flex items-start space-x-3">
                            <div className="w-24 h-24 flex-shrink-0">
                              <img
                                src={img.src}
                                alt="Classified"
                                className="w-full h-full object-cover rounded"
                              />
                            </div>
                            <div className="flex-grow">
                              {img.classification && img.classification.map((result, idx) => (
                                <div key={idx} className="mb-2">
                                  <div className="flex justify-between items-center w-full">
                                    <span className="font-medium truncate mr-2">{result.label}</span>
                                    <span className="text-sm text-gray-600 whitespace-nowrap">
                                      {(result.score * 100).toFixed(2)}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                                    <div
                                      className="bg-blue-600 h-1.5 rounded-full"
                                      style={{width: `${Math.min(result.score * 100, 100)}%`}}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Show recognized images with categories */}
              {images.some(img => Array.isArray(img.recognition) && img.recognition.length > 0) && (
                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-2">Recognized Images</h3>
                  <div className="space-y-4">
                    {images
                      .filter(img => Array.isArray(img.recognition) && img.recognition.length > 0)
                      .map((img, i) => (
                        <div key={`recog-${i}`} className="border rounded p-3">
                          <div className="flex items-start space-x-3">
                            <div className="w-24 h-24 flex-shrink-0">
                              <img
                                src={img.src}
                                alt="Recognized"
                                className="w-full h-full object-cover rounded"
                              />
                            </div>
                            <div className="flex-grow">
                              {img.recognition && img.recognition.map((category, idx) => (
                                <div key={idx} className="mb-2">
                                  <div className="flex justify-between items-center w-full">
                                    <span className="font-medium truncate mr-2">{category.name}</span>
                                    <span className="text-sm text-gray-600 whitespace-nowrap">
                                      {(category.confidence * 100).toFixed(2)}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                                    <div
                                      className="bg-green-600 h-1.5 rounded-full"
                                      style={{width: `${Math.min(category.confidence * 100, 100)}%`}}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Capture any mouse up events that occur outside the stage */}
      <div
        style={{ display: 'none' }}
        onMouseUp={handleMouseUp}
      />

      {/* Hidden file input for image uploads */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleFileChange}
      />

      {/* Chat Panel */}
      <Card className="mt-4 border-none shadow-sm">
        <CardContent className="p-4">
          <ChatPanel socket={socket} roomId={id} />
        </CardContent>
      </Card>

      {/* Image Classifier Modal */}
      <Modal show={classifierModal} onHide={() => setClassifierModal(false)} centered size="lg">
        <ModalHeader closeButton>
          <ModalTitle>Image Classification</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <VitImageClassifier
            imageData={selectedImage}
            onImageClassified={handleClassificationResults}
          />
          {selectedImage && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => {
                  addImageToCanvas({
                    src: selectedImage,
                    width: 300,
                    height: 300,
                    x: 100,
                    y: 100
                  });
                  setClassifierModal(false);
                  setSelectedImage(null);
                }}
              >
                Skip Classification and Add Image
              </Button>
            </div>
          )}
        </ModalBody>
      </Modal>

      {/* Image Recognition Modal */}
      <Modal
        show={recognitionModal}
        onHide={() => {
          setRecognitionModal(false);
          setRecognizedCategories([]);
        }}
        centered
        size="lg">
        <ModalHeader closeButton>
          <ModalTitle>Image Recognition</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <ImageRecognition
            imageData={selectedImage}
            onRecognitionComplete={handleRecognitionComplete}
          />

          {recognizedCategories.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Recognized Categories:</h3>
              <div className="space-y-2 max-w-full">
                {recognizedCategories.map((category, idx) => (
                  <div key={idx} className="flex flex-col w-full">
                    <div className="flex justify-between items-center w-full">
                      <span className="font-medium truncate mr-2">{category.name}</span>
                      <span className="text-sm text-gray-600 whitespace-nowrap">
                        {(category.confidence * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div
                        className="bg-green-600 h-1.5 rounded-full"
                        style={{width: `${Math.min(category.confidence * 100, 100)}%`}}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  className="bg-white text-black border border-gray-300 hover:bg-gray-100"
                  onClick={() => {
                    setRecognitionModal(false);
                    // Image is already added by handleRecognitionComplete
                    setSelectedImage(null);
                    setRecognizedCategories([]);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          )}

          {selectedImage && recognizedCategories.length === 0 && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                className="bg-white text-black border border-gray-300 hover:bg-gray-100"
                onClick={() => {
                  addImageToCanvas({
                    src: selectedImage,
                    width: 300,
                    height: 300,
                    x: 100,
                    y: 100
                  });
                  setRecognitionModal(false);
                  setSelectedImage(null);
                }}
              >
                Skip Recognition and Add Image
              </Button>
            </div>
          )}
        </ModalBody>
      </Modal>
    </div>
  );
};

export default WhiteboardCanvas;















