
```markdown
# CollabX 🚀

![CollabX Banner](https://via.placeholder.com/1200x400.png?text=CollabX+-+Real-Time+Collaborative+Whiteboard)

A **feature-rich real-time collaborative whiteboard application** offering secure authentication, seamless multi-user collaboration, image recognition, and a sleek modern UI with full light/dark mode support.

---

![Build Status](https://img.shields.io/github/workflow/status/your-username/CollabX/Build)
![License](https://img.shields.io/github/license/your-username/CollabX)
![Tech Stack](https://img.shields.io/badge/Tech%20Stack-React%20%7C%20TypeScript%20%7C%20Socket.io-blue)

## ✨ Features

### 🛠️ Core Functionality
- Real-time collaborative whiteboard with multi-user support
- Secure authentication powered by **Keycloak**
- Drawing tools with customizable colors and brush sizes
- Undo/Redo functionality for all actions
- Real-time cursor tracking with user identification and color coding
- Export whiteboard as **PNG** or **PDF**
- Integrated live chat for communication during collaboration
- Email invitations to onboard collaborators

### 🚀 Advanced Features
- **Light/Dark Mode** — Toggle between light and dark themes with automatic system preference detection
- **Image Recognition** — Analyze uploaded images using the **Imagga API** to identify content
- **Emoji Support** — Add and drag emojis directly on the whiteboard
- **Real-Time Notifications** — Instant alerts for collaboration events
- **Responsive Design** — Optimized for desktops, tablets, and mobile devices with smooth animations

---

## 🎨 User Interface

The application features a modern and intuitive interface with:
- Smooth animations and transitions
- Interactive elements with hover effects
- Consistent light/dark theme styling
- Real-time collaboration indicators
- Accessible controls with proper ARIA labeling

---

## 🌓 Theme System

### Light/Dark Mode
- Instantly switch between light and dark themes
- Automatic system preference detection
- Persistent user choice using **localStorage**
- Smooth and polished transitions between themes

All UI elements, including the canvas, automatically adapt based on the selected theme.

---

## 🖼️ Image Recognition (Imagga API Integration)

- Upload images directly onto the whiteboard
- Click "Recognize Image" to analyze and categorize the content
- View detailed categories and confidence scores in the sidebar
- Recognition results are linked with the uploaded image

---

## 😍 Emoji Support

Bring more expression to your collaboration:
1. Click the **"Emojis"** button to open the emoji palette
2. Select and place emojis onto the whiteboard
3. Drag and reposition emojis freely
4. Real-time synchronization of emojis across all users

---

## 👆 Real-Time Cursor Tracking

See exactly where your collaborators are working:
- Each user's cursor is displayed in real-time with their username
- Cursors are color-coded based on the user's identity
- Smooth animations make cursor movements fluid and natural
- Cursors automatically disappear when users leave the whiteboard
- Works seamlessly with drawing tools and other interactions

---

## ⚙️ Technical Implementation

Built using cutting-edge web technologies:
- **Frontend**: React, TypeScript, Konva.js for advanced canvas rendering
- **Real-time Communication**: Socket.IO
- **UI Components**: React Bootstrap and **shadcn/ui**
- **Authentication**: Keycloak for secure user authentication and management
- **AI/ML Integration**:
  - **Imagga API** for smart image recognition
- **Styling**: CSS variables and animations for smooth, theme-based transitions

---

## 🛠️ Setup Instructions

1. Start the backend services and Keycloak server:
   ```bash
   docker-compose up
   ```

2. Configure environment variables:
   ```bash
   cd frontend
   cp .env.example .env
   ```
   Then edit the `.env` file and add your API keys for Imagga and Hugging Face.

3. Install dependencies and start the frontend development server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Open your browser and navigate to [http://localhost:5173](http://localhost:5173)

---

## 📄 Environment Variables

The application requires the following environment variables:

- **Imagga API** (for image recognition):
  - `VITE_IMAGGA_API_KEY`: Your Imagga API key
  - `VITE_IMAGGA_API_SECRET`: Your Imagga API secret
  - `VITE_IMAGGA_AUTH`: Base64-encoded API credentials

---

## 🛠️ Troubleshooting

If you face any issues:
1. Check the browser console for errors
2. Verify if API keys are correctly set in the `.env` file
3. Ensure Keycloak server and configurations are properly running (refer to **KEYCLOAK-SETUP.md**)
4. For UI issues, try clearing your local storage and reloading the app

---

## 📦 Dependencies

- React & React DOM
- TypeScript
- Konva.js & react-konva (for canvas operations)
- Socket.IO (for real-time collaboration)
- React Bootstrap & shadcn UI components (for modern UI)
- Keycloak (for authentication)
- Imagga API (for image recognition)

---

---

> **CollabX** — Your ideas, your canvas, your collaboration — all in real-time. 🎨✨
```

---
