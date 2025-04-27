import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import keycloak from '../keycloak';

export interface Notification {
  id: number;
  type: 'invitation' | 'info' | 'warning';
  message: string;
  timestamp: string;
  read: boolean;
  data?: {
    whiteboardId?: number;
    inviterId?: string;
    accessLevel?: string;
  };
}

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch user notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setIsLoading(true);
        
        // Refresh token if needed
        try {
          await keycloak.updateToken(70);
        } catch (error) {
          console.error('Failed to refresh token:', error);
          keycloak.login();
          return;
        }
        
        const token = keycloak.token;
        const username = keycloak.tokenParsed?.preferred_username;
        
        if (!token || !username) return;
        
        const response = await fetch(`http://localhost:4000/notifications`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch notifications');
        }

        const data = await response.json();
        setNotifications(data);
        
        // Count unread notifications
        const unread = data.filter((n: Notification) => !n.read).length;
        setUnreadCount(unread);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
    
    // Set up polling to check for new notifications
    const intervalId = setInterval(fetchNotifications, 30000); // Check every 30 seconds
    
    return () => clearInterval(intervalId);
  }, []);

  // Mark a notification as read
  const markAsRead = async (notificationId: number) => {
    try {
      const token = keycloak.token;
      if (!token) return;
      
      const response = await fetch(`http://localhost:4000/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Handle invitation actions (accept/decline)
  const handleInvitation = async (notificationId: number, whiteboardId: number, accept: boolean) => {
    try {
      const token = keycloak.token;
      if (!token) return;
      
      const response = await fetch(`http://localhost:4000/invitations/${notificationId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accept }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${accept ? 'accept' : 'decline'} invitation`);
      }

      // Mark as read
      await markAsRead(notificationId);
      
      // Remove from notifications list
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Navigate to the whiteboard if accepted
      if (accept) {
        navigate(`/whiteboard/${whiteboardId}`);
      }
    } catch (error) {
      console.error(`Error ${accept ? 'accepting' : 'declining'} invitation:`, error);
    }
  };

  // Format timestamp to a readable format
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);
    
    if (diffMins < 60) {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="notification-center">
      {/* Notification Bell Icon */}
      <div className="position-relative d-inline-block">
        <button 
          className="btn btn-link text-dark position-relative" 
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Notifications"
        >
          <i className="fs-5">🔔</i>
          {unreadCount > 0 && (
            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
              {unreadCount > 9 ? '9+' : unreadCount}
              <span className="visually-hidden">unread notifications</span>
            </span>
          )}
        </button>
        
        {/* Notification Dropdown */}
        {isOpen && (
          <div 
            className="position-absolute end-0 mt-2 py-2 bg-white rounded shadow-lg" 
            style={{ width: '350px', maxHeight: '500px', overflowY: 'auto', zIndex: 1050 }}
          >
            <div className="d-flex justify-content-between align-items-center px-3 pb-2 border-bottom">
              <h6 className="m-0">Notifications</h6>
              <button 
                className="btn btn-sm btn-close" 
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
              ></button>
            </div>
            
            {isLoading ? (
              <div className="text-center py-3">
                <div className="spinner-border spinner-border-sm text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mb-0 mt-2 text-muted">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-3 py-4 text-center text-muted">
                <p className="mb-0">No notifications</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`px-3 py-2 border-bottom ${notification.read ? 'bg-white' : 'bg-light'}`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                  >
                    <div className="d-flex align-items-start">
                      <div className="me-2 fs-4">
                        {notification.type === 'invitation' ? '📝' : 
                         notification.type === 'warning' ? '⚠️' : 'ℹ️'}
                      </div>
                      <div className="flex-grow-1">
                        <p className="mb-1">{notification.message}</p>
                        <small className="text-muted">{formatTimestamp(notification.timestamp)}</small>
                        
                        {/* Invitation Actions */}
                        {notification.type === 'invitation' && notification.data?.whiteboardId && (
                          <div className="mt-2 d-flex gap-2">
                            <button 
                              className="btn btn-sm btn-success" 
                              onClick={() => handleInvitation(notification.id, notification.data.whiteboardId!, true)}
                            >
                              Accept
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-danger" 
                              onClick={() => handleInvitation(notification.id, notification.data.whiteboardId!, false)}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter; 