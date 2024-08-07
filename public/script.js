const socket = io();
let localStream;
let remoteStream;
let peerConnection;
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

document.getElementById('chat-option').addEventListener('click', () => {
  startChat('chat');
});

document.getElementById('video-option').addEventListener('click', () => {
  startChat('video');
});

document.getElementById('send-button').addEventListener('click', () => {
  const message = document.getElementById('message-input').value;
  if (message) {
    socket.emit('chat message', { message });
    document.getElementById('message-input').value = '';
  }
});

document.getElementById('skip-button').addEventListener('click', () => {
  clearChatBox();
  socket.emit('skip');
});

socket.on('chat message', ({ sender, message }) => {
  addMessageToChat(sender, message);
});

socket.on('self message', ({ sender, message }) => {
  addMessageToChat(sender, message);
});

socket.on('matched', async (data) => {
  document.getElementById('status').textContent = 'Connected to a stranger';
  if (data.type === 'video') {
    document.getElementById('video-chat').classList.remove('hidden');
    await startVideoChat();
  } else {
    document.getElementById('video-chat').classList.add('hidden');
  }
});

socket.on('finding', () => {
  document.getElementById('status').textContent = 'Finding...';
});

socket.on('strangerDisconnected', () => {
  document.getElementById('status').textContent = 'Stranger disconnected. Finding new stranger...';
  clearChatBox();
  socket.emit('skip');
});

async function startChat(type) {
  const tags = document.getElementById('tags').value.split(',').map(tag => tag.trim());
  if (tags.length > 0) {
    socket.emit('setType', type);
    socket.emit('join', tags);
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('chat-container').classList.remove('hidden');
    document.getElementById('status').textContent = 'Finding...';
  } else {
    alert('Please enter at least one tag.');
  }
}

async function startVideoChat() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('local-video').srcObject = localStream;

    peerConnection = new RTCPeerConnection(configuration);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
      if (!remoteStream) {
        remoteStream = new MediaStream();
        document.getElementById('remote-video').srcObject = remoteStream;
      }
      remoteStream.addTrack(event.track);
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', event.candidate);
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer);

    socket.on('answer', async (answer) => {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async (candidate) => {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding received ice candidate', e);
      }
    });

    socket.on('offer', async (offer) => {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('answer', answer);
    });
  } catch (e) {
    console.error('Error accessing media devices.', e);
  }
}

document.getElementById('toggle-video').addEventListener('click', () => {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
  }
});

function addMessageToChat(sender, message) {
  const item = document.createElement('div');
  item.textContent = `${sender === 'you' ? 'You' : 'Stranger'}: ${message}`;
  item.classList.add('message', sender);
  document.getElementById('chat-box').appendChild(item);
  document.getElementById('chat-box').scrollTop = document.getElementById('chat-box').scrollHeight;
}

function clearChatBox() {
  const chatBox = document.getElementById('chat-box');
  while (chatBox.firstChild) {
    chatBox.removeChild(chatBox.firstChild);
  }
}
