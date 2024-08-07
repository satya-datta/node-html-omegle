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

  socket.on('join', (tags) => {
    socket.tags = tags;
    socket.chatting = false;
  
    let matched = false;
    for (let i = 0; i < waitingUsers.length; i++) {
      if (waitingUsers[i].tags.some(tag => tags.includes(tag))) {
        const matchedUser = waitingUsers.splice(i, 1)[0];
        const room = `${socket.id}#${matchedUser.socket.id}`;
  
        socket.join(room);
        matchedUser.socket.join(room);
  
        socket.room = room;
        matchedUser.socket.room = room;
  
        socket.emit('matched', { type: matchedUser.socket.type });
        matchedUser.socket.emit('matched', { type: socket.type });
  
        matched = true;
        break;
      }
    }
  
    if (!matched) {
      waitingUsers.push({ socket, tags, type: socket.type });
    }
  });
  

  socket.on('setType', (type) => {
    socket.type = type;
  });

  socket.on('chat message', (msg) => {
    socket.to(socket.room).emit('chat message', { sender: 'stranger', message: msg.message });
    socket.emit('self message', { sender: 'you', message: msg.message });
  });

  socket.on('skip', () => {
    socket.leave(socket.room);
    socket.to(socket.room).emit('strangerDisconnected');
    waitingUsers = waitingUsers.filter(user => user.socket !== socket);
    socket.emit('finding');
    joinQueue(socket);
  });

  socket.on('disconnect', () => {
    waitingUsers = waitingUsers.filter(user => user.socket !== socket);
    socket.to(socket.room).emit('strangerDisconnected');
    console.log('User disconnected');
  });
});

function joinQueue(socket) {
  let matched = false;
  for (let i = 0; i < waitingUsers.length; i++) {
    if (waitingUsers[i].tags.some(tag => socket.tags.includes(tag))) {
      const matchedUser = waitingUsers.splice(i, 1)[0];
      const room = `${socket.id}#${matchedUser.socket.id}`;

      socket.join(room);
      matchedUser.socket.join(room);

      socket.room = room;
      matchedUser.socket.room = room;

      socket.emit('matched', { type: matchedUser.socket.type });
      matchedUser.socket.emit('matched', { type: socket.type });

      matched = true;
      break;
    }
  }

  if (!matched) {
    waitingUsers.push({ socket, tags: socket.tags, type: socket.type });
  }
}

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
