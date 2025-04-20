const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

let waitingUser = null;

io.on("connection", (socket) => {
  console.log("使用者已連線:", socket.id);

  if (waitingUser) {
    // 配對
    socket.partner = waitingUser;
    waitingUser.partner = socket;

    socket.emit("offer", { from: waitingUser.id });
    waitingUser.emit("offer", { from: socket.id });

    waitingUser = null;
  } else {
    waitingUser = socket;
  }

  // 收到 answer
  socket.on("answer", (data) => {
    if (socket.partner) {
      socket.partner.emit("answer", data);
    }
  });

  // ICE candidate
  socket.on("ice-candidate", (candidate) => {
    if (socket.partner) {
      socket.partner.emit("ice-candidate", candidate);
    }
  });

  socket.on("disconnect", () => {
    if (socket.partner) {
      socket.partner.partner = null;
      socket.partner = null;
    }
    if (waitingUser === socket) {
      waitingUser = null;
    }
    console.log("使用者已離線:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
