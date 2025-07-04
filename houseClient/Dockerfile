# Use official Node.js image
FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Expose the port Expo uses for web
EXPOSE 8081

# Start Expo in web mode
CMD ["npx", "expo", "start", "--web", "--non-interactive", "--port", "8081"]
