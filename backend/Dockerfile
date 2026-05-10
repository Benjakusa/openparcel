FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p logs && adduser -D appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 5000
CMD ["node", "server.js"]
