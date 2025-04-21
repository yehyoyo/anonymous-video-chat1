const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// 提供靜態前端檔案
app.use(express.static(path.join(__dirname, "public")));

let waitingUser = null;

io.on("connection", (socket) => {
  console.log(`🟢 使用者已連線: ${socket.id}`);

  // 加入配對佇列
  socket.on("join", () => {
    console.log(`➡️ ${socket.id} 加入配對佇列`);

    // 先清掉舊的配對資訊
    socket.partner = null;

    if (waitingUser && waitingUser.id !== socket.id) {
      // 成功配對
      socket.partner = waitingUser;
      waitingUser.partner = socket;

      socket.emit("ready", waitingUser.id);
      waitingUser.emit("ready", socket.id);

      console.log(`✅ 配對成功: ${socket.id} <--> ${waitingUser.id}`);

      waitingUser = null;
    } else {
      // 沒人等，進入等待
      waitingUser = socket;
      console.log(`⏳ ${socket.id} 等待配對中`);
    }
  });

  // 傳送 offer
  socket.on("offer", ({ to, sdp }) => {
    console.log(`📤 ${socket.id} 傳送 offer 給 ${to}`);
    io.to(to).emit("offer", { from: socket.id, sdp });
  });

  // 傳送 answer
  socket.on("answer", ({ to, sdp }) => {
    console.log(`📥 ${socket.id} 傳送 answer 給 ${to}`);
    io.to(to).emit("answer", { sdp });
  });

  // 傳送 ICE candidate
  socket.on("ice-candidate", (candidate) => {
    if (socket.partner) {
      socket.partner.emit("ice-candidate", candidate);
    }
  });

  // 中斷處理
  socket.on("disconnect", () => {
    console.log(`🔴 使用者離線: ${socket.id}`);

    if (waitingUser === socket) {
      waitingUser = null;
    }

    if (socket.partner) {
      socket.partner.emit("disconnect");
      socket.partner.partner = null;
    }
  });

  // 使用者主動離線（點了「離開」或「下一個」）
  socket.on("manual-leave", () => {
    console.log(`🚪 ${socket.id} 主動離開聊天室`);

    if (waitingUser === socket) {
      waitingUser = null;
    }

    if (socket.partner) {
      socket.partner.emit("disconnect");
      socket.partner.partner = null;
    }

    socket.partner = null;
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
