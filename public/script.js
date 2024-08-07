const socket = io();
let username;
let tags;
let localStream;
let remoteStream;
let peerConnection;
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

document.getElementById('start').addEventListener('click', () => {
  username = document.getElementById('username').value;
  tags = document.getElementById('tags').value.split(',').map(tag => tag.trim());

  if (username && tags.length > 0) {
    socket.emit('join', { username, tags });
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('chat-container').classList.remove('hidden');
  } else {
    alert('Please enter a username and at least one tag.');
  }
});

document.getElementById('send-button').addEventListener('click', () => {
  const message = document.getElementById('message-input').value;
  if (message) {
    socket.emit('chat message', { message });
    document.getElementById('message-input').value = ''; // Clear the input field after sending
  }
});

socket.on('chat message', ({ sender, message }) => {
  addMessageToChat(sender, message);
});

socket.on('self message', ({ sender, message }) => {
  addMessageToChat(sender, message);
});

socket.on('matched', async (data) => {
  alert('You have been matched with ' + data.username);
  document.getElementById('video-chat').classList.remove('hidden');
  await startVideoChat();
});

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
