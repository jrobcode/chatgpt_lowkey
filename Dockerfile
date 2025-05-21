# Use official node image with Debian base
FROM node:18-bullseye

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy rest of app
COPY . .

# Expose port (change if needed)
EXPOSE 3000

# Start your app
CMD ["node", "server.js"]
