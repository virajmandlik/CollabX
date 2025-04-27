import { useEffect, useState } from 'react';
import keycloak from './keycloak';
import { Container, Row, Col, Button, Card, Modal } from 'react-bootstrap';
import { FaPlus, FaPencilAlt, FaTrash, FaDownload } from 'react-icons/fa';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import './animations.css';
import { useNavigate } from 'react-router-dom';
import NotificationCenter from './components/NotificationCenter';
import ThemeToggle from './components/ThemeToggle';
import { PenLine, Sparkles, Palette, Users, Lightbulb } from 'lucide-react';

interface Whiteboard {
  id: number;
  title: string;
  content: {
    elements: any[];
  };
  created_at: string;
}

function App() {
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchWhiteboards();
  }, []);

  const fetchWhiteboards = async () => {
    try {
      // Refresh token if needed
      try {
        await keycloak.updateToken(70);
      } catch (error) {
        console.error('Failed to refresh token:', error);
        keycloak.login();
        return;
      }

      const token = keycloak.token;
      if (!token) {
        console.error("No token available");
        return;
      }

      console.log("Fetching whiteboards with token...");
      const res = await fetch('http://localhost:4000/whiteboards', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("❌ Fetch whiteboards failed:", text);
        return;
      }

      const data = await res.json();
      setWhiteboards(data);
    } catch (err) {
      console.error("❌ fetchWhiteboards() error:", err);
    }
  };

  // Add token refresh handling
  useEffect(() => {
    const refreshToken = async () => {
      try {
        const refreshed = await keycloak.updateToken(70);
        if (refreshed) {
          console.log('Token refreshed');
        }
      } catch (error) {
        console.error('Failed to refresh token:', error);
        keycloak.login();
      }
    };

    refreshToken();
    const interval = setInterval(refreshToken, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

  const createWhiteboard = async () => {
    try {
      const token = keycloak.token;
      const res = await fetch('http://localhost:4000/whiteboards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newBoardTitle || 'New Board',
          content: { elements: [] },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("❌ Create whiteboard failed:", text);
        return;
      }

      const data = await res.json();
      setWhiteboards(prev => [...prev, data]);
      setShowCreateModal(false);
      setNewBoardTitle('');
    } catch (err) {
      console.error("❌ createWhiteboard() error:", err);
    }
  };

  const handleEditBoard = (id: number) => {
    navigate(`/whiteboard/${id}`);
  };

  const handleDeleteBoard = (id: number) => {
    setBoardToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteBoard = async () => {
    if (!boardToDelete) return;
    try {
      // Refresh token if needed
      try {
        await keycloak.updateToken(70);
      } catch (error) {
        console.error('Failed to refresh token:', error);
        keycloak.login();
        return;
      }

      const token = keycloak.token;
      console.log(`Attempting to delete whiteboard ${boardToDelete}...`);

      const res = await fetch(`http://localhost:4000/whiteboards/${boardToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("❌ Delete whiteboard failed:", text);
        alert(`Failed to delete whiteboard: ${text}`);
        return;
      }

      console.log(`Whiteboard ${boardToDelete} deleted successfully`);
      setWhiteboards(prev => prev.filter(board => board.id !== boardToDelete));
      setShowDeleteModal(false);
      setBoardToDelete(null);
    } catch (err) {
      console.error("❌ deleteWhiteboard() error:", err);
      alert("Failed to delete whiteboard. Please try again.");
    }
  };

  const handleExportBoard = async (id: number) => {
    try {
      const token = keycloak.token;
      const res = await fetch(`http://localhost:4000/whiteboards/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("❌ Fetch whiteboard for export failed:", text);
        return;
      }

      const board = await res.json();
      const dataStr = JSON.stringify(board, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

      const exportName = `whiteboard-${board.id}-${board.title.replace(/\s+/g, '-').toLowerCase()}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportName);
      linkElement.click();
    } catch (err) {
      console.error("❌ exportWhiteboard() error:", err);
    }
  };

  const [showWelcome, setShowWelcome] = useState(true);

  // Hide welcome message after 3 seconds
  useEffect(() => {
    if (showWelcome) {
      const timer = setTimeout(() => {
        setShowWelcome(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome]);

  return (
    <Container fluid className="p-4">
      {/* Welcome Message Overlay */}
      {showWelcome && (
        <div className="welcome-message">
          <div className="welcome-message-content">
            <h1 className="mb-3 text-primary">Welcome to CollabX</h1>
            <p className="lead">Create, share, and collaborate on interactive whiteboards in real-time</p>
          </div>
        </div>
      )}

      {/* Header */}
      <nav className="navbar navbar-dark bg-gradient-blue dashboard-header mb-4 px-4 py-3 animate-fadeIn">
        <span className="navbar-brand d-flex align-items-center">
          <PenLine className="me-2" size={24} />
          <span className="fw-bold">CollabX</span>
        </span>
        <div className="d-flex align-items-center">
          <ThemeToggle />
          <NotificationCenter />
          <span className="text-light me-3 d-flex align-items-center">
            <Users className="me-2" size={18} />
            Welcome, {keycloak.tokenParsed?.preferred_username}
          </span>
          <Button
            variant="outline-light"
            size="sm"
            className="hover-lift"
            onClick={() => keycloak.logout({ redirectUri: window.location.origin })}
          >
            Logout
          </Button>
        </div>
      </nav>

      {/* Feature Highlights */}
      <div className="mb-5 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
        <Row className="g-4">
          <Col md={4}>
            <div className="p-4 rounded bg-light hover-lift text-center">
              <div className="mb-3 text-primary">
                <Sparkles size={32} />
              </div>
              <h5>Real-time Collaboration</h5>
              <p className="text-muted mb-0">Work together with your team in real-time</p>
            </div>
          </Col>
          <Col md={4}>
            <div className="p-4 rounded bg-light hover-lift text-center">
              <div className="mb-3 text-success">
                <Palette size={32} />
              </div>
              <h5>Creative Tools</h5>
              <p className="text-muted mb-0">Express your ideas with our drawing tools</p>
            </div>
          </Col>
          <Col md={4}>
            <div className="p-4 rounded bg-light hover-lift text-center">
              <div className="mb-3 text-warning">
                <Lightbulb size={32} />
              </div>
              <h5>Share Ideas</h5>
              <p className="text-muted mb-0">Easily share and export your whiteboards</p>
            </div>
          </Col>
        </Row>
      </div>

      {/* Create Button */}
      <Row className="mb-4 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
        <Col>
          <Button
            variant="primary"
            size="lg"
            className="d-flex align-items-center gap-2 create-button animate-pulse"
            onClick={() => setShowCreateModal(true)}
          >
            <FaPlus /> Create New Whiteboard
          </Button>
        </Col>
      </Row>

      {/* Whiteboards Grid */}
      <h4 className="mb-3 animate-fadeIn" style={{ animationDelay: '0.4s' }}>Your Whiteboards</h4>
      <Row xs={1} md={2} lg={3} className="g-4">
        {whiteboards.map((board, index) => (
          <Col key={board.id} className="animate-slideInUp stagger-item" style={{ animationDelay: `${0.1 + index * 0.1}s` }}>
            <Card className="h-100 dashboard-card">
              <Card.Body>
                <Card.Title className="d-flex justify-content-between align-items-center">
                  <span>{board.title}</span>
                  <span className="badge bg-primary rounded-pill">
                    {board.content.elements?.length || 0} elements
                  </span>
                </Card.Title>
                <Card.Text className="text-muted">
                  Created: {new Date(board.created_at).toLocaleDateString()}
                </Card.Text>
                <div className="d-flex gap-2 mt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-100 hover-lift"
                    onClick={() => handleEditBoard(board.id)}
                  >
                    <FaPencilAlt className="me-1" /> Edit
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    className="w-100 hover-lift"
                    onClick={() => handleExportBoard(board.id)}
                  >
                    <FaDownload className="me-1" /> Export
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="w-100 hover-lift"
                    onClick={() => handleDeleteBoard(board.id)}
                  >
                    <FaTrash className="me-1" /> Delete
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Create Whiteboard Modal */}
      {showCreateModal && (
        <div className="modal show d-block animate-fadeIn" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-gradient-blue text-white">
                <h5 className="modal-title">Create New Whiteboard</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowCreateModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="mb-3">
                  <label htmlFor="boardTitle" className="form-label">Board Title</label>
                  <input
                    id="boardTitle"
                    type="text"
                    className="form-control form-control-lg"
                    placeholder="Enter a name for your whiteboard"
                    value={newBoardTitle}
                    onChange={(e) => setNewBoardTitle(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <Button variant="outline-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={createWhiteboard} className="px-4">
                  <FaPlus className="me-2" /> Create
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal show d-block animate-fadeIn" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">Confirm Delete</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowDeleteModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="d-flex align-items-center">
                  <div className="text-danger me-3">
                    <FaTrash size={24} />
                  </div>
                  <p className="mb-0">Are you sure you want to delete this whiteboard? This action cannot be undone.</p>
                </div>
              </div>
              <div className="modal-footer">
                <Button variant="outline-secondary" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={confirmDeleteBoard}>
                  Delete Permanently
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Backdrop */}
      {(showCreateModal || showDeleteModal) && (
        <div className="modal-backdrop show"></div>
      )}
    </Container>
  );
}

export default App;




