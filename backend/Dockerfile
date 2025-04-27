FROM node:18

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Install ts-node-dev globally (optional but nice)
RUN npm install -g ts-node-dev

# Run the dev server
CMD ["npm", "run", "dev"]
