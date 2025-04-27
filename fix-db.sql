-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS update_whiteboards_timestamp ON whiteboards;

-- Drop the trigger function if it exists
DROP FUNCTION IF EXISTS update_modified_column();

-- Drop the tables if they exist
DROP TABLE IF EXISTS collaborators;
DROP TABLE IF EXISTS whiteboards;

-- Create the whiteboards table
CREATE TABLE whiteboards (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content JSONB,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the collaborators table
CREATE TABLE collaborators (
  id SERIAL PRIMARY KEY,
  whiteboard_id INTEGER REFERENCES whiteboards(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'read',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(whiteboard_id, user_id)
);

-- Create the trigger function
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the trigger
CREATE TRIGGER update_whiteboards_timestamp
BEFORE UPDATE ON whiteboards
FOR EACH ROW
EXECUTE FUNCTION update_modified_column(); 