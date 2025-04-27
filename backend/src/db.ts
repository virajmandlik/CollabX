import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'keycloak',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'appDB',
});

const RETRIES = 5;

export const initDB = async () => {
  console.log('Initializing database...');

  try {
    // Check connection
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL');

    // Start a transaction
    await client.query('BEGIN');

    try {
      // Check if whiteboards table exists
      const whiteboardsTableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'whiteboards'
        );
      `);

      if (!whiteboardsTableExists.rows[0].exists) {
        console.log('Creating whiteboards table...');
        await client.query(`
          CREATE TABLE whiteboards (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
      }

      // Check if updated_at column exists in whiteboards table
      const updatedAtColumnExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'whiteboards' 
          AND column_name = 'updated_at'
        );
      `);

      if (!updatedAtColumnExists.rows[0].exists) {
        console.log('Adding updated_at column to whiteboards table...');
        await client.query(`
          ALTER TABLE whiteboards 
          ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        `);
      }

      // Create or update the trigger function
      await client.query(`
        CREATE OR REPLACE FUNCTION update_modified_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE 'plpgsql';
      `);

      // Check if trigger exists
      const triggerExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_trigger 
          WHERE tgname = 'update_whiteboards_modified'
        );
      `);

      if (!triggerExists.rows[0].exists) {
        console.log('Creating trigger for updated_at...');
        await client.query(`
          CREATE TRIGGER update_whiteboards_modified
          BEFORE UPDATE ON whiteboards
          FOR EACH ROW
          EXECUTE FUNCTION update_modified_column();
        `);
      }

      // Check if collaborators table exists
      const collaboratorsTableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'collaborators'
        );
      `);

      if (!collaboratorsTableExists.rows[0].exists) {
        console.log('Creating collaborators table...');
        await client.query(`
          CREATE TABLE collaborators (
            id SERIAL PRIMARY KEY,
            whiteboard_id INTEGER REFERENCES whiteboards(id) ON DELETE CASCADE,
            user_id VARCHAR(255) NOT NULL,
            access_level VARCHAR(50) DEFAULT 'read',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(whiteboard_id, user_id)
          );
        `);
      }

      // Check if notifications table exists
      const notificationsTableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'notifications'
        );
      `);

      if (!notificationsTableExists.rows[0].exists) {
        console.log('Creating notifications table...');
        await client.query(`
          CREATE TABLE notifications (
          id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            data JSONB DEFAULT '{}'::jsonb,
            read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
      }

      // Check if invitations table exists
      const invitationsTableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'invitations'
        );
      `);

      if (!invitationsTableExists.rows[0].exists) {
        console.log('Creating invitations table...');
        await client.query(`
          CREATE TABLE invitations (
            id SERIAL PRIMARY KEY,
            whiteboard_id INTEGER REFERENCES whiteboards(id) ON DELETE CASCADE,
            inviter_id VARCHAR(255) NOT NULL,
            invitee_id VARCHAR(255) NOT NULL,
            access_level VARCHAR(50) DEFAULT 'read',
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL,
            UNIQUE(whiteboard_id, invitee_id)
          );
        `);
      }

      // Commit transaction
      await client.query('COMMIT');
      console.log('✅ Database initialization complete');
    } catch (err) {
      // Rollback in case of error
      await client.query('ROLLBACK');
      console.error('❌ Error in database initialization:', err);
      throw err;
    } finally {
      // Release client
      client.release();
    }
  } catch (err) {
    console.error('❌ Database connection error:', err);
    throw err;
  }
};

export default pool;
