@echo off
echo Stopping Docker containers...
docker-compose down -v

echo Building backend...
cd backend
npm run build
cd ..

echo Starting Docker containers...
docker-compose up -d

echo Waiting for PostgreSQL to start...
timeout /t 10

echo Done! Please try accessing the whiteboard again. 