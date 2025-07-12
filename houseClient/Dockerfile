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


### DOCKER COMPOSE FILE ###
# house-client:
#     container_name: house-client
#     build:
#       context: ./houseClient
#       dockerfile: Dockerfile
#     ports:
#       - "8081:8081"
#     environment:
#       - NODE_ENV=development
#       - EXPO_PUBLIC_API_BASE_URL=http://localhost:8080
#     networks:
#       - internal
#     depends_on:
#       - signaler
#     restart: unless-stopped