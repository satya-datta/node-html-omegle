const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let waitingUsers = [];

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('join', ({ username, tags }) => {
    socket.username = username;
    socket.tags = tags;

    let matched = false;
    for (let i = 0; i < waitingUsers.length; i++) {
      if (waitingUsers[i].tags.some(tag => tags.includes(tag))) {
        const matchedUser = waitingUsers.splice(i, 1)[0];
        const room = `${socket.id}#${matchedUser.socket.id}`;

        socket.join(room);
        matchedUser.socket.join(room);

        socket.room = room;
        matchedUser.socket.room = room;

        socket.emit('matched', { username: matchedUser.socket.username });
        matchedUser.socket.emit('matched', { username });

        matched = true;
        break;
      }
    }

    if (!matched) {
      waitingUsers.push({ socket, username, tags });
    }
  });

  socket.on('chat message', (msg) => {
    // Emit the message to the other user in the room
    socket.to(socket.room).emit('chat message', { sender: 'stranger', message: msg.message });
    // Only emit the message to the sender directly (without using rooms)
    socket.emit('self message', { sender: 'you', message: msg.message });
  });

  socket.on('offer', (offer) => {
    socket.to(socket.room).emit('offer', offer);
  });

  socket.on('answer', (answer) => {
    socket.to(socket.room).emit('answer', answer);
  });

  socket.on('ice-candidate', (candidate) => {
    socket.to(socket.room).emit('ice-candidate', candidate);
  });

  socket.on('disconnect', () => {
    waitingUsers = waitingUsers.filter(user => user.socket !== socket);
    console.log('User disconnected');
  });
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
