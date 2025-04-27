import express, { Request, Response, NextFunction } from 'express';
import { initDB } from './db';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import pool from './db';
import dotenv from 'dotenv';
import cors from 'cors';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { Socket } from 'socket.io';
// import axios from 'axios';
// import FormData from 'form-data';
// import fileUpload from 'express-fileupload';

// Type declaration for Express Request with user
declare global {
  namespace Express {
    interface Request {
      user?: {
        preferred_username: string;
        email: string;
        sub: string;
      }
    }
  }
}

// Enhanced error handling
class AppError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

dotenv.config();

// Room clients tracker - maps roomId to a set of socketIds
const roomClients: { [roomId: string]: Set<string> } = {};

const app = express();
const port = 4000;
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// 🔒 Socket.io authentication middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.error('Socket auth error: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }
    
    console.log('Socket auth: Token received', token.slice(0, 10) + '...');
    
    // Get user info from token
    let decoded: any;
    try {
      decoded = jwt.decode(token, { complete: true });
      if (!decoded) {
        console.error('Socket auth error: Could not decode token');
        return next(new Error('Authentication error: Invalid token'));
      }
    } catch (error) {
      console.error('Socket auth error: Error decoding token:', error);
      return next(new Error('Authentication error: Invalid token'));
    }

    // Handle different token structures from various Keycloak versions
    const payload = decoded.payload || decoded;
    
    if (!payload) {
      console.error('Socket auth error: Invalid token structure: No payload found');
      return next(new Error('Authentication error: Invalid token'));
    }

    // Handle different property names for username
    const username = payload.preferred_username || payload.name || payload.email || payload.sub;
    if (!username) {
      console.error('Socket auth error: No username found in token payload:', payload);
      return next(new Error('Authentication error: Invalid user info'));
    }
    
    // Add user info to socket
    (socket as any).user = {
      preferred_username: username,
      email: payload.email || '',
      sub: payload.sub || ''
    };
    
    console.log('Socket auth success for user:', username);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
});

// ✅ Middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
// app.use(fileUpload({
//   limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
// }));

// Request logger middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ✅ Health check
app.get('/', (_req, res) => {
  res.send('✅ Whiteboard backend is running!');
});

// Test route without authentication
app.get('/test', (req: Request, res: Response) => {
  console.log('Test route accessed');
  res.json({
    status: 'ok',
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
});

// Add a debug route for Keycloak config
app.get('/debug/keycloak-config', (req: Request, res: Response) => {
  console.log('Keycloak config route accessed');
  
  // Send the expected Keycloak configuration
  res.json({
    server_url: 'http://localhost:8080',
    realm: 'whiteboard-app',
    client_id: 'whiteboard-client',
    time: new Date().toISOString()
  });
});

// Add a token verification test route
app.post('/debug/verify-token', (req: Request, res: Response) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.decode(token, { complete: true });
    res.json({
      valid: true,
      decoded,
      time: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      valid: false,
      error: String(error),
      time: new Date().toISOString()
    });
  }
});

// ✅ Initialize DB
initDB();

// 🔐 Middleware: Validate Keycloak JWT
const checkJwt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.error('Missing Authorization header');
      return res.status(401).send('Missing Authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.error('Invalid token format');
      return res.status(401).send('Invalid token format');
    }

    console.log('Token received:', token.slice(0, 10) + '...');
    
    // Get user info from token
    let decoded: any;
    try {
      decoded = jwt.decode(token, { complete: true });
      if (!decoded) {
        console.error('Invalid token format (could not decode)');
        return res.status(401).send('Invalid token format');
      }
    } catch (error) {
      console.error('Error decoding token:', error);
      return res.status(401).send('Invalid token');
    }

    // Handle different token structures from various Keycloak versions
    const payload = decoded.payload || decoded;
    
    if (!payload) {
      console.error('Invalid token structure: No payload found');
      return res.status(401).send('Invalid token structure');
    }

    // Handle different property names for username (preferred_username or name or sub)
    const username = payload.preferred_username || payload.name || payload.email || payload.sub;
    if (!username) {
      console.error('No username found in token payload:', payload);
      return res.status(401).send('Invalid token: No username');
    }

    console.log('Token decoded, username:', username);

    // Add user info to request
    req.user = {
      preferred_username: username,
      email: payload.email || '',
      sub: payload.sub || ''
    };

    next();
  } catch (error) {
    console.error('JWT Validation Error:', error);
    return res.status(401).send('Token validation failed');
  }
};

// 🎯 Routes

// ➕ Create a whiteboard
app.post('/whiteboards', checkJwt, (req: Request, res: Response) => {
  const { title, content } = req.body;
  const created_by = (req as any).user.preferred_username;
  console.log(`Creating whiteboard with title: ${title} for user: ${created_by}`);

  pool.query(
      `INSERT INTO whiteboards (title, content, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [title, content, created_by]
  )
    .then(result => {
      console.log(`Whiteboard created successfully, ID: ${result.rows[0].id}`);
    res.json(result.rows[0]);
    })
    .catch(err => {
    console.error("Error inserting whiteboard:", err);
    res.status(500).send("Error creating whiteboard");
    });
});

// 📄 Get whiteboards for logged-in user
app.get('/whiteboards', checkJwt, (req: Request, res: Response) => {
  const created_by = (req as any).user.preferred_username;
  console.log(`Fetching whiteboards for user: ${created_by}`);

    // Get both owned and shared whiteboards
  pool.query(
      `SELECT DISTINCT w.* FROM whiteboards w
       LEFT JOIN collaborators c ON w.id = c.whiteboard_id
       WHERE w.created_by = $1 OR c.user_id = $1
       ORDER BY w.created_at DESC`,
      [created_by]
  )
    .then(result => {
      console.log(`Found ${result.rows.length} whiteboards for user ${created_by}`);
    res.json(result.rows);
    })
    .catch(err => {
    console.error("Error fetching whiteboards:", err);
    res.status(500).send("Error fetching whiteboards");
    });
});

// 📄 Get whiteboard by ID
app.get('/whiteboards/:id', checkJwt, (req: Request, res: Response) => {
  const { id } = req.params;
  const created_by = (req as any).user.preferred_username;
  console.log(`Fetching whiteboard ID: ${id} for user: ${created_by}`);

    // Check if user is either the creator or a collaborator
  pool.query(
      `SELECT w.* FROM whiteboards w
       LEFT JOIN collaborators c ON w.id = c.whiteboard_id
       WHERE w.id = $1 AND (w.created_by = $2 OR c.user_id = $2)`,
      [id, created_by]
  )
    .then(result => {
    if (result.rows.length === 0) {
        console.log(`Access denied: User ${created_by} tried to access whiteboard ${id}`);
        res.status(404).send("Whiteboard not found or access denied");
        return;
    }
    
      console.log(`Whiteboard ${id} fetched successfully for user ${created_by}`);
    res.json(result.rows[0]);
    })
    .catch(err => {
      console.error(`Error fetching whiteboard ${id}:`, err);
    res.status(500).send("Error fetching whiteboard");
    });
});

// 📝 Update whiteboard by ID
app.put('/whiteboards/:id', checkJwt, async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  const created_by = (req as any).user.preferred_username;

  try {
    // First check if the whiteboard belongs to the user or they are a collaborator
    const checkResult = await pool.query(
      `SELECT w.* FROM whiteboards w
       LEFT JOIN collaborators c ON w.id = c.whiteboard_id
       WHERE w.id = $1 AND (w.created_by = $2 OR (c.user_id = $2 AND c.access_level IN ('write', 'admin')))`,
      [id, created_by]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).send("Whiteboard not found or access denied");
    }
    
    // Build the update query based on what fields are provided
    let query = `UPDATE whiteboards SET `;
    const queryParams = [];
    let paramIndex = 1;
    
    if (title !== undefined) {
      query += `title = $${paramIndex}, `;
      queryParams.push(title);
      paramIndex++;
    }
    
    if (content !== undefined) {
      query += `content = $${paramIndex}, `;
      queryParams.push(content);
      paramIndex++;
    }
    
    // Remove trailing comma and space
    query = query.slice(0, -2);
    
    // Add WHERE clause and RETURNING
    query += ` WHERE id = $${paramIndex} RETURNING *`;
    queryParams.push(id);
    
    const result = await pool.query(query, queryParams);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating whiteboard:", err);
    res.status(500).send("Error updating whiteboard");
  }
});

// 🗑️ Delete whiteboard by ID
app.delete('/whiteboards/:id', checkJwt, (req: Request, res: Response) => {
  const { id } = req.params;
  const created_by = req.user?.preferred_username;

  console.log(`Attempting to delete whiteboard ${id} by user ${created_by}`);

    // First check if the whiteboard belongs to the user
  pool.query(
      `SELECT * FROM whiteboards WHERE id = $1 AND created_by = $2`,
      [id, created_by]
  )
    .then(checkResult => {
    if (checkResult.rows.length === 0) {
        console.log(`Deletion denied: User ${created_by} tried to delete whiteboard ${id} but is not the owner`);
        res.status(403).send("Only the owner can delete a whiteboard");
        return;
    }
    
    // Delete collaborators first (foreign key constraint)
      return pool.query(
      `DELETE FROM collaborators WHERE whiteboard_id = $1`,
      [id]
      )
        .then(() => {
    // Delete the whiteboard
          return pool.query(
      `DELETE FROM whiteboards WHERE id = $1 RETURNING *`,
      [id]
    );
        })
        .then(result => {
    if (result.rows.length === 0) {
            res.status(404).send("Whiteboard not found");
            return;
    }
    
          console.log(`Whiteboard ${id} deleted successfully by user ${created_by}`);
    res.json({ message: "Whiteboard deleted successfully", id });
        });
    })
    .catch(err => {
      console.error(`Error deleting whiteboard ${id}:`, err);
    res.status(500).send("Error deleting whiteboard");
    });
});

// ➕ Add collaborator to whiteboard
app.post('/whiteboards/:id/collaborators', checkJwt, async (req, res) => {
  const { id } = req.params;
  const { email, accessLevel } = req.body;
  const created_by = (req as any).user.preferred_username;

  // Don't allow self-invitation
  if (email === created_by) {
    return res.status(400).send("You cannot invite yourself");
  }

  try {
    // Start a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // First check if the user is the owner
      const checkResult = await client.query(
        `SELECT title FROM whiteboards WHERE id = $1 AND created_by = $2`,
        [id, created_by]
      );
      
      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).send("Only the owner can add collaborators");
      }
      
      const whiteboardTitle = checkResult.rows[0].title;
      
      // Create notification for the invited user
      const message = `${created_by} invited you to collaborate on whiteboard "${whiteboardTitle}"`;
      const notificationResult = await client.query(
        `INSERT INTO notifications (user_id, type, message, data) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        [email, 'invitation', message, JSON.stringify({ 
          whiteboardId: parseInt(id),
          inviterId: created_by,
          accessLevel
        })]
      );
      
      const notificationId = notificationResult.rows[0].id;
      
      // Create invitation record
      const invitationResult = await client.query(
        `INSERT INTO invitations (whiteboard_id, inviter_id, invitee_id, access_level, notification_id) 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (whiteboard_id, invitee_id) 
         DO UPDATE SET 
           access_level = $4, 
           status = 'pending', 
           notification_id = $5
         RETURNING *`,
        [id, created_by, email, accessLevel || 'read', notificationId]
      );
      
      await client.query('COMMIT');
      res.json(invitationResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error adding collaborator:", err);
    res.status(500).send("Error adding collaborator");
  }
});

// 📄 Get collaborators for a whiteboard
app.get('/whiteboards/:id/collaborators', checkJwt, async (req, res) => {
  const { id } = req.params;
  const created_by = (req as any).user.preferred_username;

  try {
    // First check if the user has access to this whiteboard
    const checkResult = await pool.query(
      `SELECT w.* FROM whiteboards w
       LEFT JOIN collaborators c ON w.id = c.whiteboard_id
       WHERE w.id = $1 AND (w.created_by = $2 OR c.user_id = $2)`,
      [id, created_by]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).send("Whiteboard not found or access denied");
    }
    
    // Get all collaborators
    const result = await pool.query(
      `SELECT * FROM collaborators WHERE whiteboard_id = $1`,
      [id]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching collaborators:", err);
    res.status(500).send("Error fetching collaborators");
  }
});

// 📄 Get notifications
app.get('/notifications', checkJwt, (req: Request, res: Response) => {
  const username = (req as any).user.preferred_username;
  console.log(`Fetching notifications for user: ${username}`);

  pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [username]
  )
    .then(result => {
      console.log(`Found ${result.rows.length} notifications for user ${username}`);
    res.json(result.rows);
    })
    .catch(err => {
    console.error("Error fetching notifications:", err);
    res.status(500).send("Error fetching notifications");
    });
});

// 📝 Mark notification as read
app.put('/notifications/:id/read', checkJwt, async (req, res) => {
  const { id } = req.params;
  const username = (req as any).user.preferred_username;

  try {
    // Verify notification belongs to the user
    const checkResult = await pool.query(
      `SELECT * FROM notifications WHERE id = $1 AND user_id = $2`,
      [id, username]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).send("Notification not found or access denied");
    }
    
    // Mark as read
    const result = await pool.query(
      `UPDATE notifications SET read = true WHERE id = $1 RETURNING *`,
      [id]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error marking notification as read:", err);
    res.status(500).send("Error marking notification as read");
  }
});

// 📝 Accept or decline invitation
app.put('/invitations/:id', checkJwt, async (req, res) => {
  const { id } = req.params;
  const { accept } = req.body;
  const username = (req as any).user.preferred_username;

  try {
    // Start a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Find the invitation and associated notification
      const invitationResult = await client.query(
        `SELECT i.*, n.id as notification_id, w.title as whiteboard_title
         FROM invitations i 
         JOIN notifications n ON i.notification_id = n.id
         JOIN whiteboards w ON i.whiteboard_id = w.id
         WHERE n.id = $1 AND n.user_id = $2`,
        [id, username]
      );
      
      if (invitationResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).send("Invitation not found or already processed");
      }
      
      const invitation = invitationResult.rows[0];
      
      // Mark the notification as read
      await client.query(
        `UPDATE notifications SET read = true WHERE id = $1`,
        [invitation.notification_id]
      );
      
      if (accept) {
        // Add as collaborator
        await client.query(
          `INSERT INTO collaborators (whiteboard_id, user_id, access_level) 
           VALUES ($1, $2, $3)
           ON CONFLICT (whiteboard_id, user_id) 
           DO UPDATE SET access_level = $3`,
          [invitation.whiteboard_id, username, invitation.access_level]
        );
        
        // Update invitation status
        await client.query(
          `UPDATE invitations SET status = 'accepted' WHERE notification_id = $1`,
          [invitation.notification_id]
        );
        
        // Send notification to inviter
        const notificationText = `${username} accepted your invitation to collaborate on "${invitation.whiteboard_title}"`;
        await client.query(
          `INSERT INTO notifications (user_id, type, message, data) 
           VALUES ($1, $2, $3, $4)`,
          [invitation.inviter_id, 'info', notificationText, JSON.stringify({ whiteboardId: invitation.whiteboard_id })]
        );
      } else {
        // Update invitation status
        await client.query(
          `UPDATE invitations SET status = 'declined' WHERE notification_id = $1`,
          [invitation.notification_id]
        );
        
        // Send notification to inviter
        const notificationText = `${username} declined your invitation to collaborate on "${invitation.whiteboard_title}"`;
        await client.query(
          `INSERT INTO notifications (user_id, type, message, data) 
           VALUES ($1, $2, $3, $4)`,
          [invitation.inviter_id, 'info', notificationText, JSON.stringify({ whiteboardId: invitation.whiteboard_id })]
        );
      }
      
      await client.query('COMMIT');
      res.json({ success: true, action: accept ? 'accepted' : 'declined' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`Error ${accept ? 'accepting' : 'declining'} invitation:`, err);
    res.status(500).send(`Error ${accept ? 'accepting' : 'declining'} invitation`);
  }
});

// Image classification endpoint
// app.post('/classify-image', checkJwt, async (req, res) => { ... });

// Add function to check user's whiteboard access level
const checkUserAccess = async (userId: string, whiteboardId: string): Promise<string> => {
  try {
    // First check if the user is the owner
    const ownerResult = await pool.query(
      `SELECT * FROM whiteboards WHERE id = $1 AND created_by = $2`,
      [whiteboardId, userId]
    );
    
    if (ownerResult.rows.length > 0) {
      return 'admin'; // Owner has admin access
    }
    
    // Otherwise check if they are a collaborator
    const collabResult = await pool.query(
      `SELECT access_level FROM collaborators WHERE whiteboard_id = $1 AND user_id = $2`,
      [whiteboardId, userId]
    );
    
    if (collabResult.rows.length > 0) {
      return collabResult.rows[0].access_level;
    }
    
    return 'none'; // No access
  } catch (err) {
    console.error('Error checking user access:', err);
    return 'none';
  }
};

// 🚀 Socket.io setup for real-time collaboration
io.on('connection', (socket) => {
  console.log(`New client connected: ${(socket as any).user.preferred_username}`);
  
  // Join a whiteboard room
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${(socket as any).user.preferred_username} joined room: ${roomId}`);
    
    // Store the roomId on the socket for access level checks
    (socket as any).currentRoom = roomId;
    
    // Notify others that someone joined
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      username: (socket as any).user.preferred_username,
      timestamp: new Date().toISOString()
    });
    
    // Request current state from other clients in the room
    socket.to(roomId).emit('request-current-state', { 
      userId: socket.id,
      timestamp: new Date().toISOString()
    });
    
    // Keep track of connected clients for this room
    if (!roomClients[roomId]) {
      roomClients[roomId] = new Set();
    }
    roomClients[roomId].add(socket.id);
    
    // Let the client know the current clients in the room
    socket.emit('room-info', {
      clients: Array.from(roomClients[roomId]),
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle state synchronization between clients
  socket.on('send-current-state', (data) => {
    const { roomId, userId, currentState } = data;
    
    // Forward the current state only to the specific client that requested it
    io.to(userId).emit('receive-current-state', { 
      currentState,
      fromUserId: socket.id,
      timestamp: new Date().toISOString()
    });
    
    console.log(`State sent from ${socket.id} to ${userId}`);
  });
  
  // Handle drawing events
  socket.on('draw', async (data) => {
    const { roomId, line, isNewLine } = data;
    const username = (socket as any).user.preferred_username;
    
    // Check user's access level before processing drawing action
    const accessLevel = await checkUserAccess(username, roomId);
    
    // Only users with write or admin access can draw
    if (accessLevel !== 'write' && accessLevel !== 'admin') {
      console.log(`User ${username} attempted to draw without permission`);
      return;
    }
    
    const lineId = line.lineId; // Extract lineId from the line object if present
    
    // Forward the drawing update to all other clients in the room
    socket.to(roomId).emit('draw', { 
      line, 
      lineId,
      userId: socket.id,
      isNewLine: isNewLine === true,
      timestamp: new Date().toISOString() 
    });
  });
  
  // Handle cursor position updates
  socket.on('cursor-move', (data) => {
    const { roomId, position, color, username } = data;
    socket.to(roomId).emit('cursor-move', { 
      position,
      userId: socket.id,
      color,
      username
    });
  });
  
  // Handle chat messages
  socket.on('chat-message', (data) => {
    const { roomId, message, username } = data;
    socket.to(roomId).emit('chat-message', {
      message,
      userId: socket.id,
      username,
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle image uploads
  socket.on('add-image', async (data) => {
    const { roomId, image } = data;
    const username = (socket as any).user.preferred_username;
    
    try {
      // Check user's access level before processing image action
      const accessLevel = await checkUserAccess(username, roomId);
      
      // Only users with write or admin access can add images
      if (accessLevel !== 'write' && accessLevel !== 'admin') {
        console.log(`User ${username} attempted to add an image without permission`);
        return;
      }
      
      console.log(`User ${socket.id} added an image to room ${roomId}`, {
        imageSize: image.src.length,
        hasClassification: !!image.classification
      });
      
      // Forward the image to all other clients in the room
      socket.to(roomId).emit('add-image', {
        image: {
          src: image.src,
          x: image.x,
          y: image.y,
          width: image.width,
          height: image.height,
          classification: image.classification || []
        },
        userId: socket.id,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error handling add-image:', error);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    
    // Find which rooms this socket was in
    Object.keys(roomClients).forEach(roomId => {
      if (roomClients[roomId].has(socket.id)) {
        // Remove from tracking
        roomClients[roomId].delete(socket.id);
        
        // Notify the room
        socket.to(roomId).emit('user-left', {
          userId: socket.id,
          timestamp: new Date().toISOString()
        });
        
        // Clean up empty rooms
        if (roomClients[roomId].size === 0) {
          delete roomClients[roomId];
        }
      }
    });
  });
});

// 📄 Get current user's access level for a whiteboard
app.get('/whiteboards/:id/access', checkJwt, async (req, res) => {
  const { id } = req.params;
  const username = (req as any).user.preferred_username;

  try {
    // First check if the user is the owner
    const ownerResult = await pool.query(
      `SELECT * FROM whiteboards WHERE id = $1 AND created_by = $2`,
      [id, username]
    );
    
    if (ownerResult.rows.length > 0) {
      return res.json({ accessLevel: 'admin' }); // Owner has admin access
    }
    
    // Otherwise check if they are a collaborator
    const collabResult = await pool.query(
      `SELECT access_level FROM collaborators WHERE whiteboard_id = $1 AND user_id = $2`,
      [id, username]
    );
    
    if (collabResult.rows.length > 0) {
      return res.json({ accessLevel: collabResult.rows[0].access_level });
    }
    
    // No access
    res.status(403).json({ accessLevel: 'none' });
  } catch (err) {
    console.error("Error checking access level:", err);
    res.status(500).send("Error checking access level");
  }
});

// 🚀 Start server
server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Backend listening on http://0.0.0.0:${port}`);
});

// Log any server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Log socket.io errors
io.on('error', (error) => {
  console.error('Socket.io error:', error);
});

// Connection logging
io.engine.on('connection_error', (err) => {
  console.error('Connection error:', err);
});

// Ping the DB to make sure it's connected
pool.query('SELECT 1')
  .then(() => {
    console.log('✅ Database connected successfully');
  })
  .catch(err => {
    console.error('❌ Database connection error:', err);
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

