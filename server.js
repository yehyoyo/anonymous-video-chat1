const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// 提供前端 static 靜態資料夾（index.html 應位於 public 中）
app.use(express.static(path.join(__dirname, "public")));

let waitingUser = null;

io.on("connection", (socket) => {
  console.log(`🟢 使用者已連線: ${socket.id}`);

  socket.partner = null;

  socket.on("join", () => {
    console.log(`➡️ ${socket.id} 請求配對`);
    if (waitingUser === socket) waitingUser = null;

    if (waitingUser && waitingUser.id !== socket.id) {
      // 成功配對
      socket.partner = waitingUser;
      waitingUser.partner = socket;

      socket.emit("ready", waitingUser.id);
      waitingUser.emit("ready", socket.id);

      console.log(`✅ 配對完成: ${socket.id} <--> ${waitingUser.id}`);
      waitingUser = null;
    } else {
      // 進入等待佇列
      waitingUser = socket;
      console.log(`⏳ ${socket.id} 進入等待中...`);
    }
  });

  socket.on("offer", ({ to, sdp }) => {
    console.log(`📤 ${socket.id} 傳送 offer 給 ${to}`);
    io.to(to).emit("offer", { from: socket.id, sdp });
  });

  socket.on("answer", ({ to, sdp }) => {
    console.log(`📥 ${socket.id} 傳送 answer 給 ${to}`);
    io.to(to).emit("answer", { sdp });
  });

  socket.on("ice-candidate", (candidate) => {
    console.log(`❄️ ${socket.id} 傳送 ICE 候選`);
    if (socket.partner) {
      socket.partner.emit("ice-candidate", candidate);
    } else {
      console.warn(`⚠️ ${socket.id} 沒有配對對象，ICE 被忽略`);
    }
  });

  socket.on("manual-leave", () => {
    console.log(`🚪 ${socket.id} 主動離開聊天室`);
    handleDisconnect(socket);
  });

  socket.on("disconnect", () => {
    console.log(`🔴 使用者離線: ${socket.id}`);
    handleDisconnect(socket);
  });

  function handleDisconnect(s) {
    if (waitingUser && waitingUser.id === s.id) {
      console.log(`❌ ${s.id} 從等待佇列中移除`);
      waitingUser = null;
    }

    if (s.partner) {
      console.log(`⚠️ 通知 ${s.partner.id}：對方離開`);
      s.partner.emit("partner-left");
      s.partner.partner = null;
    }

    s.partner = null;
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
