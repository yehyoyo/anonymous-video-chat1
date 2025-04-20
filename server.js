const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// 設定靜態資源路徑
app.use(express.static('public'));

// Socket.io 處理
io.on('connection', socket => {
  console.log('a user connected');
  // 加上你原本的 socket 處理邏輯
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, "public")));

let waitingUser = null;

io.on("connection", (socket) => {
  console.log("有使用者連線", socket.id);

  if (waitingUser) {
    // 有人在等 → 配對他們
    socket.partner = waitingUser;
    waitingUser.partner = socket;

    socket.emit("offer", { from: waitingUser.id });
    waitingUser.emit("offer", { from: socket.id });

    waitingUser = null;
  } else {
    // 沒人等 → 自己先等
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

  socket.on("leave", () => {
    if (socket.partner) {
      socket.partner.emit("leave");
      socket.partner.partner = null;
    }
    socket.partner = null;
    waitingUser = null;
  });

  socket.on("disconnect", () => {
    if (socket.partner) {
      socket.partner.emit("leave");
      socket.partner.partner = null;
    }
    if (waitingUser === socket) {
      waitingUser = null;
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
