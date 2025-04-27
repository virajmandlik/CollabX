import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import keycloak from '../keycloak';

interface ChatMessage {
  message: string;
  userId: string;
  username: string;
  timestamp: string;
  isSelf?: boolean;
}

interface ChatPanelProps {
  socket: Socket | null;
  roomId: string | undefined;
}

const ChatPanel = ({ socket, roomId }: ChatPanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const username = keycloak.tokenParsed?.preferred_username || 'Anonymous';

  // Handle receiving chat messages
  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (data: ChatMessage) => {
      setMessages((prev) => [...prev, { ...data, isSelf: false }]);
    };

    socket.on('chat-message', handleChatMessage);

    return () => {
      socket.off('chat-message', handleChatMessage);
    };
  }, [socket]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !socket || !roomId) return;
    
    // Send the message
    socket.emit('chat-message', {
      roomId,
      message: inputMessage,
      username
    });
    
    // Add to local messages
    const newMessage: ChatMessage = {
      message: inputMessage,
      userId: 'self',
      username,
      timestamp: new Date().toISOString(),
      isSelf: true
    };
    
    setMessages([...messages, newMessage]);
    setInputMessage('');
  };

  return (
    <div className={`chat-panel position-fixed end-0 bottom-0 m-3 ${isExpanded ? 'expanded' : 'collapsed'}`} 
         style={{ 
           width: '300px', 
           backgroundColor: 'white', 
           borderRadius: '8px',
           boxShadow: '0 0 10px rgba(0,0,0,0.1)',
           overflow: 'hidden',
           zIndex: 1000,
           height: isExpanded ? '400px' : '50px'
         }}>
      
      {/* Chat Header */}
      <div className="chat-header p-2 bg-primary text-white d-flex justify-content-between align-items-center"
           onClick={() => setIsExpanded(!isExpanded)}
           style={{ cursor: 'pointer' }}>
        <h6 className="m-0">Chat</h6>
        <div>
          <span className="badge bg-light text-dark">{messages.length}</span>
          <button className="btn btn-sm text-white ms-2">
            {isExpanded ? '▼' : '▲'}
          </button>
        </div>
      </div>
      
      {/* Chat Body - only visible when expanded */}
      {isExpanded && (
        <>
          <div className="chat-messages p-2" style={{ height: '310px', overflowY: 'auto' }}>
            {messages.length === 0 ? (
              <div className="text-center text-muted p-4">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={index}
                  className={`message mb-2 p-2 rounded ${msg.isSelf ? 'align-self-end bg-primary text-white' : 'bg-light'}`}
                  style={{ 
                    maxWidth: '80%', 
                    alignSelf: msg.isSelf ? 'flex-end' : 'flex-start',
                    marginLeft: msg.isSelf ? 'auto' : '0',
                    display: 'block'
                  }}
                >
                  <div className="message-sender small fw-bold">
                    {msg.isSelf ? 'You' : msg.username}
                  </div>
                  <div className="message-content">
                    {msg.message}
                  </div>
                  <div className="message-time small text-end" style={{ opacity: 0.7 }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="chat-input p-2 border-top">
            <div className="input-group">
              <input
                type="text"
                className="form-control"
                placeholder="Type your message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
              />
              <button 
                type="submit"
                className="btn btn-primary"
                disabled={!inputMessage.trim() || !socket}
              >
                Send
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default ChatPanel; 