const socket = io();
let tags;
let localStream;
let remoteStream;
let peerConnection;
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

document.getElementById('start').addEventListener('click', () => {
  tags = document.getElementById('tags').value.split(',').map(tag => tag.trim());

  if (tags.length > 0) {
    socket.emit('join', { tags });
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('chat-container').classList.remove('hidden');
  } else {
    alert('Please enter at least one tag.');
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

socket.on('matched', async () => {
  alert('You have been matched!');
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

    socket.on('remote-mic-toggle', (status) => {
      document.querySelector('#remote-video-container .overlay').style.display = status ? 'none' : 'block';
      displayNotification(`Stranger turned ${status ? 'on' : 'off'} their mic`);
    });

    socket.on('remote-video-toggle', (status) => {
      document.getElementById('remote-video').style.display = status ? 'block' : 'none';
      displayNotification(`Stranger turned ${status ? 'on' : 'off'} their video`);
    });

  } catch (e) {
    console.error('Error accessing media devices.', e);
  }
}

document.getElementById('toggle-video').addEventListener('click', () => {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  updateToggleButton('toggle-video', videoTrack.enabled);
  document.getElementById('local-video-container .overlay').style.display = videoTrack.enabled ? 'none' : 'block';
  socket.emit('video-toggle', videoTrack.enabled);
});

document.getElementById('toggle-mic').addEventListener('click', () => {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  updateToggleButton('toggle-mic', audioTrack.enabled);
  document.getElementById('local-mic-status').style.display = audioTrack.enabled ? 'none' : 'block';
  socket.emit('mic-toggle', audioTrack.enabled);
});

function updateToggleButton(buttonId, enabled) {
  const button = document.getElementById(buttonId);
  if (enabled) {
    button.textContent = `Turn Off ${buttonId === 'toggle-video' ? 'Video' : 'Mic'}`;
    button.classList.add('on');
    button.classList.remove('off');
  } else {
    button.textContent = `Turn On ${buttonId === 'toggle-video' ? 'Video' : 'Mic'}`;
    button.classList.add('off');
    button.classList.remove('on');
  }
}

function displayNotification(message) {
  const chatBox = document.getElementById('chat-box');
  const item = document.createElement('div');
  item.textContent = message;
  item.classList.add('message', 'notification');
  chatBox.appendChild(item);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function addMessageToChat(sender, message) {
  const item = document.createElement('div');
  item.textContent = `${sender === 'you' ? 'You' : 'Stranger'}: ${message}`;
  item.classList.add('message', sender);
  document.getElementById('chat-box').appendChild(item);
  document.getElementById('chat-box').scrollTop = document.getElementById('chat-box').scrollHeight;
}
