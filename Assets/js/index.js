let localStream;
let username;
let remoteUser;
let peerConnection;
let remoteStream;
let sendChannel;
let receiveChannel;

let url = new URL(window.location.href);
username = url.searchParams.get("username");
remoteUser = url.searchParams.get("remoteuser");

var msgInput = document.querySelector("#msg-input");
var msgSendBtn = document.querySelector(".msg-send-button");
var chatTextArea = document.querySelector(".chat-text-area");

var omeID = localStorage.getItem("omeID");
if (omeID) {
  username = omeID;
  $.ajax({
    url: "/new-user-update/" + omeID + "",
    type: "PUT",
    success: function (response) {
      alert(response);
    },
  });
} else {
  var postData = "Demo Data";
  $.ajax({
    type: "POST",
    url: "/api/users",
    data: postData,
    success: function (response) {
      console.log(response);
      localStorage.setItem("omeID", response);
      username = response;
    },
    error: function (error) {
      console.log(error);
    },
  });
}

let init = async () => {
  try {
    //Media capture devices includes video cameras and microphones
    const constraints = { video: true, audio: true };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    const videoElement = document.getElementById("user-1");

    //Once a media device has been opened and we have a MediaStream available,
    //we can assign it to a video or audio element to play the stream locally.
    videoElement.srcObject = localStream;
    createOffer();
  } catch (error) {
    //Error opening video camera.
    console.error("Error opening video camera.", error);
  }
};

init();

let socket = io.connect();

socket.on("connect", () => {
  if (socket.connected) {
    socket.emit("userconnect", {
      displayName: username,
    });
  }
});

// In order to discover how two peers can connect,
//  both clients need to provide an ICE Server configuration.
//  This is either a STUN or a TURN-server,
//  and their role is to provide ICE candidates to each client which is then transferred to the remote peer.
//  This transferring of ICE candidates is commonly called signaling.

let servers = {
  iceServers: [
    {
      urls: ["stun:stun1.1.google.com:19302", "stun:stun2.1.google.com:19302"],
    },
  ],
};

let createPeerConnection = async () => {
  peerConnection = new RTCPeerConnection(servers);

  remoteStream = new MediaStream();

  document.getElementById("user-2").srcObject = remoteStream;

  // This is the point where we connect the stream we receive from getUserMedia() to the RTCPeerConnection.
  // A media stream consists of at least one media track,
  // and these are individually added to the RTCPeerConnection
  // when we want to transmit the media to the remote peer.

  localStream.getTracks().forEach((track) => {
    // Tracks can be added to a RTCPeerConnection before it has connected to a remote peer,
    // so it makes sense to perform this setup
    //  as early as possible instead of waiting for the connection to be completed.
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = async (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  remoteStream.oninactive = () => {
    remoteStream.getTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    peerConnection.close();
  };

  peerConnection.onicecandidate = async (event) => {
    // Listen for local ICE candidates on the local RTCPeerConnection
    if (event.candidate) {
      socket.emit("candidateSentToUser", {
        username: username,
        remoteUser: remoteUser,
        iceCandidateData: event.candidate,
      });
    }
  };

  // The WebRTC standard also covers an API for sending arbitrary data over a RTCPeerConnection.
  // This is done by calling createDataChannel() on a RTCPeerConnection object,
  // which returns a RTCDataChannel object.
  sendChannel = peerConnection.createDataChannel("sendDataChannel");

  sendChannel.onopen = () => {
    console.log("Data channel is now open and ready to use");
    onSendChannelStateChange();
  };

  // The remote peer can receive data channels by listening for the datachannel event on the RTCPeerConnection object.
  // The received event is of the type RTCDataChannelEvent
  // and contains a channel property that represents the RTCDataChannel connected between the peers.

  peerConnection.ondatachannel = receiveChannelCallback;
  // sendChannel.onmessage=onSendChannelMessageCallBack;
};

function sendData() {
  // Sending a message on a RTCDataChannel is done by calling the send() function with the data we want to send.
  // The data parameter for this function can be either a string,
  // a Blob, an ArrayBuffer or and ArrayBufferView.

  const msgData = msgInput.value;
  chatTextArea.innerHTML +=
    "<div style='margin-top:2px; margin-bottom:2px;'><b>Me: </b>" +
    msgData +
    "</div>";

  // Before a data channel can be used for sending data,
  // the client needs to wait until it has been opened.
  // This is done by listening to the open event.
  // Likewise, there is a close event for when either side closes the channel.

  if (sendChannel) {
    onSendChannelStateChange();
    sendChannel.send(msgData);
    msgInput.value = "";
  } else {
    // The remote peer will receive messages sent on a RTCDataChannel by listening on the message event.
    receiveChannel.send(msgData);
    msgInput.value = "";
  }
}
function receiveChannelCallback(event) {
  // Before a data channel can be used for Receiving data,
  // the client needs to wait until it has been opened.
  // This is done by listening to the open event.
  // Likewise, there is a close event for when either side closes the channel.

  console.log("Receive Channel Callback");
  receiveChannel = event.channel;
  receiveChannel.onmessage = onReceiveChannelMessageCallback;
  receiveChannel.onopen = onReceiveChannelStateChange;
  receiveChannel.onclose = onReceiveChannelStateChange;
}
function onReceiveChannelMessageCallback(event) {
  console.log("Received Message");
  chatTextArea.innerHTML +=
    "<div style='margin-top:2px; margin-bottom:2px;'><b>Stranger: </b>" +
    event.data +
    "</div>";
}
function onReceiveChannelStateChange() {
  const readystate = receiveChannel.readystate;
  console.log("Receive channel state is: " + readystate);
  if (readystate === "open") {
    console.log(
      "Data channel ready state is open - onReceiveChannelStateChange"
    );
  } else {
    console.log(
      "Data channel ready state is NOT open - onReceiveChannelStateChange"
    );
  }
}
function onSendChannelStateChange() {
  const readystate = sendChannel.readystate;
  console.log("Send channel state is: " + readystate);
  if (readystate === "open") {
    console.log("Data channel ready state is open - onSendChannelStateChange");
  } else {
    console.log(
      "Data channel ready state is NOT open - onSendChannelStateChange"
    );
  }
}
let createOffer = async () => {
  // we create a RTCPeerConnection object
  createPeerConnection();

  // and then call createOffer() to create a RTCSessionDescription object.
  let offer = await peerConnection.createOffer();

  // This session description is set as the local description using setLocalDescription()
  await peerConnection.setLocalDescription(offer);

  //  and is then sent over our signaling channel to the receiving side
  socket.emit("offerSentToRemote", {
    username: username,
    remoteUser: remoteUser,
    offer: peerConnection.localDescription,
  });
};

let createAnswer = async (data) => {
  remoteUser = data.username;

  // On the receiving side, we wait for an incoming offer before we create our RTCPeerConnection instance.
  createPeerConnection();

  //  Once that is done we set the received offer using setRemoteDescription().
  await peerConnection.setRemoteDescription(data.offer);

  //  Next, we call createAnswer() to create an answer to the received offer.
  let answer = await peerConnection.createAnswer();

  //  This answer is set as the local description using setLocalDescription()
  await peerConnection.setLocalDescription(answer);

  //  and then sent to the calling side over our signaling server.
  socket.emit("answerSentToUser1", {
    answer: answer,
    sender: data.remoteUser,
    receiver: data.username,
  });
};

socket.on("ReceiveOffer", function (data) {
  createAnswer(data);
});

let addAnswer = async (data) => {
  if (!peerConnection.currentRemoteDescription) {
    peerConnection.setRemoteDescription(data.answer);
  }
};

socket.on("ReceiveAnswer", function (data) {
  addAnswer(data);
});

socket.on("candidateReceiver", function (data) {
  // Listen for remote ICE candidates and add them to the local RTCPeerConnection
  peerConnection.addIceCandidate(data.iceCandidateData);
});

msgSendBtn.addEventListener("click", function (event) {
  sendData();
});

window.addEventListener("unload", function (event) {
  $.ajax({
    url: "/leaving-user-update/" + username + "",
    type: "PUT",
    success: function (response) {
      alert(response);
    },
  });
});
