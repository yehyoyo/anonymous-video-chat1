const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// 靜態檔案路徑設定
app.use(express.static(path.join(__dirname, "public")));

let waitingUser = null;

// Socket.io 處理連線
io.on("connection", (socket) => {
  console.log("有使用者連線:", socket.id);

  if (waitingUser) {
    // 有人在等，配對
    socket.partner = waitingUser;
    waitingUser.partner = socket;

    socket.emit("offer", { from: waitingUser.id });
    waitingUser.emit("offer", { from: socket.id });

    waitingUser = null;
  } else {
    // 沒人等，自己變成等待者
    waitingUser = socket;
  }

  socket.on("answer", (data) => {
    if (socket.partner) {
      socket.partner.emit("answer", data);
    }
  });

  socket.on("ice-candidate", (candidate) => {
    if (socket.partner) {
      socket.partner.emit("ice-candidate", candidate);
    }
  });

  socket.on("disconnect", () => {
    console.log("使用者離線:", socket.id);
    if (socket.partner) {
      socket.partner.partner = null;
      socket.partner.emit("leave");
    }
    if (waitingUser === socket) {
      waitingUser = null;
    }
  });

  socket.on("leave", () => {
    if (socket.partner) {
      socket.partner.emit("leave");
      socket.partner.partner = null;
      socket.partner = null;
    }
    waitingUser = null;
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
