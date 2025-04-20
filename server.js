const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// 靜態檔案（public資料夾）
app.use(express.static(path.join(__dirname, "public")));

let waitingUser = null;

io.on("connection", (socket) => {
  console.log("使用者連線:", socket.id);

  if (waitingUser) {
    // 配對
    socket.partner = waitingUser;
    waitingUser.partner = socket;

    // 送出 offer 通知
    socket.emit("offer", { from: waitingUser.id });
    waitingUser.emit("offer", { from: socket.id });

    waitingUser = null;
  } else {
    // 沒人等，自己變成等待者
    waitingUser = socket;
  }

  // 接收到 answer
  socket.on("answer", ({ offer, to }) => {
    io.to(to).emit("answer", { offer });
  });

  // ICE candidate 傳遞
  socket.on("candidate", (candidate) => {
    if (socket.partner) {
      socket.partner.emit("candidate", candidate);
    }
  });

  socket.on("disconnect", () => {
    console.log("使用者離線:", socket.id);
    if (waitingUser === socket) {
      waitingUser = null;
    }
    if (socket.partner) {
      socket.partner.emit("leave");
      socket.partner.partner = null;
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
