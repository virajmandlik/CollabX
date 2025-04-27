import { useState, useEffect } from 'react';
import keycloak from '../keycloak';

interface Collaborator {
  id: number;
  whiteboard_id: number;
  user_id: string;
  access_level: string;
}

interface CollaboratorInviteProps {
  whiteboardId: string | undefined;
}

const CollaboratorInvite = ({ whiteboardId }: CollaboratorInviteProps) => {
  const [email, setEmail] = useState('');
  const [accessLevel, setAccessLevel] = useState<string>('read');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);

  // Fetch existing collaborators
  useEffect(() => {
    if (!whiteboardId) return;
    
    const fetchCollaborators = async () => {
      try {
        setIsLoading(true);
        const token = keycloak.token;
        const res = await fetch(`http://localhost:4000/whiteboards/${whiteboardId}/collaborators`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error('Failed to fetch collaborators');
        }

        const data = await res.json();
        setCollaborators(data);
      } catch (err) {
        console.error('Error fetching collaborators:', err);
        setError('Failed to load collaborators');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCollaborators();
  }, [whiteboardId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!whiteboardId) {
      setError('Whiteboard ID is missing');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      const token = keycloak.token;
      const res = await fetch(`http://localhost:4000/whiteboards/${whiteboardId}/collaborators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          accessLevel,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to invite collaborator');
      }

      const newCollaborator = await res.json();
      setCollaborators([...collaborators, newCollaborator]);
      setEmail('');
      setSuccess(`Invitation sent to ${email}`);
    } catch (err) {
      console.error('Error inviting collaborator:', err);
      setError(err instanceof Error ? err.message : 'Failed to invite collaborator');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="collaborator-invite mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Collaborators</h4>
        <button 
          className="btn btn-outline-primary btn-sm"
          onClick={() => setShowInviteForm(!showInviteForm)}
        >
          {showInviteForm ? 'Cancel' : 'Invite Collaborator'}
        </button>
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <form onSubmit={handleInvite} className="mb-4 p-3 border rounded bg-light">
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email Address</label>
            <input
              type="email"
              id="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="accessLevel" className="form-label">Access Level</label>
            <select
              id="accessLevel"
              className="form-select"
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value)}
            >
              <option value="read">View Only</option>
              <option value="write">Can Edit</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Send Invitation'}
          </button>
        </form>
      )}

      {/* Collaborators List */}
      <div className="collaborators-list">
        {isLoading && !showInviteForm ? (
          <p className="text-center">Loading collaborators...</p>
        ) : collaborators.length > 0 ? (
          <table className="table table-hover">
            <thead>
              <tr>
                <th>User</th>
                <th>Access Level</th>
              </tr>
            </thead>
            <tbody>
              {collaborators.map((collaborator) => (
                <tr key={collaborator.id}>
                  <td>{collaborator.user_id}</td>
                  <td>
                    <span className={`badge bg-${
                      collaborator.access_level === 'read' ? 'secondary' :
                      collaborator.access_level === 'write' ? 'primary' : 'success'
                    }`}>
                      {collaborator.access_level === 'read' ? 'View Only' :
                       collaborator.access_level === 'write' ? 'Can Edit' : 'Admin'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center text-muted">No collaborators yet</p>
        )}
      </div>
    </div>
  );
};

export default CollaboratorInvite; 