require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./db/connect');
const roomRoutes = require('./routes/room');
const setupSockets = require('./sockets/game');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST']
  }
});

app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
app.use(express.json());

app.use('/api', roomRoutes);

setupSockets(io);

const PORT = process.env.PORT || 5000;

connectDB().finally(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
