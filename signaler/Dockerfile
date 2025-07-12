# Use official Node.js LTS image
FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Install wget for health checks
RUN apt-get update && apt-get install -y wget && apt-get clean

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --include=optional sharp

# Copy the rest of the application code
COPY . .

# Expose the port the signaler runs on
EXPOSE 8080

# Build TypeScript (if needed)
RUN npm run build

# Start the signaler
CMD ["npm", "run", "start"]
