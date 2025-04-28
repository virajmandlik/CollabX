import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

interface RemoteCursor {
  userId: string;
  username: string;
  position: { x: number; y: number };
  color: string;
  lastUpdated: number;
}

interface CursorLayerProps {
  socket: Socket | null;
  roomId: string | undefined;
  stageWidth: number;
  stageHeight: number;
}

const CursorLayer = ({ socket, roomId, stageWidth, stageHeight }: CursorLayerProps) => {
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});

  // Listen for cursor movements from other users
  useEffect(() => {
    if (!socket) return;

    const handleCursorMove = (data: { userId: string; position: { x: number; y: number }; color: string; username: string }) => {
      const { userId, position, color, username } = data;
      setCursors(prev => ({
        ...prev,
        [userId]: {
          userId,
          username,
          position,
          color,
          lastUpdated: Date.now()
        }
      }));
    };

    const handleUserLeft = (data: { userId: string }) => {
      const { userId } = data;
      setCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
    };

    socket.on('cursor-move', handleCursorMove);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('cursor-move', handleCursorMove);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket]);

  // Clean up stale cursors (remove cursors that haven't been updated in 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors(prev => {
        const newCursors = { ...prev };
        Object.keys(newCursors).forEach(key => {
          if (now - newCursors[key].lastUpdated > 10000) {
            delete newCursors[key];
          }
        });
        return newCursors;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="cursor-layer" style={{ position: 'absolute', pointerEvents: 'none', top: 0, left: 0, width: stageWidth, height: stageHeight }}>
      {Object.values(cursors).map(cursor => (
        <div
          key={cursor.userId}
          style={{
            position: 'absolute',
            left: cursor.position.x,
            top: cursor.position.y,
            transform: 'translate(-50%, -50%)',
            transition: 'left 0.1s, top 0.1s',
            zIndex: 1000
          }}
        >
          {/* Cursor icon */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderBottom: `15px solid ${cursor.color || '#007bff'}`,
              transform: 'rotate(-45deg)',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
              animation: 'pulse 2s infinite'
            }}
          />

          {/* Username label */}
          <div
            style={{
              backgroundColor: cursor.color || '#007bff',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              marginTop: '2px',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              opacity: 0.9,
              fontWeight: 'bold'
            }}
          >
            {cursor.username || 'Guest'}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CursorLayer;