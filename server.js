const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// 提供前端靜態檔案（/public/index.html）
app.use(express.static(path.join(__dirname, "public")));

let waitingUser = null;

io.on("connection", (socket) => {
  console.log(`🟢 使用者已連線: ${socket.id}`);
  socket.partner = null;

  socket.on("join", () => {
    console.log(`➡️ ${socket.id} 請求配對`);

    // 清除殘留的等待狀態
    if (waitingUser === socket) {
      waitingUser = null;
    }

    if (waitingUser && waitingUser.id !== socket.id) {
      // 配對成功
      socket.partner = waitingUser;
      waitingUser.partner = socket;

      socket.emit("ready", waitingUser.id);
      waitingUser.emit("ready", socket.id);

      console.log(`✅ 配對完成: ${socket.id} <--> ${waitingUser.id}`);
      waitingUser = null;
    } else {
      waitingUser = socket;
      console.log(`⏳ ${socket.id} 加入等待佇列`);
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
    if (socket.partner) {
      console.log(`🧊 ${socket.id} 傳送 ICE 給 ${socket.partner.id}`);
      socket.partner.emit("ice-candidate", candidate);
    } else {
      console.log(`⚠️ ICE 傳送失敗：${socket.id} 沒有 partner`);
    }
  });

  // 使用者主動離線（按下離開或下一個）
  socket.on("manual-leave", () => {
    console.log(`🚪 ${socket.id} 手動離線`);
    handleDisconnect(socket);
  });

  // 使用者斷線（關閉頁面）
  socket.on("disconnect", () => {
    console.log(`🔴 ${socket.id} 離線`);
    handleDisconnect(socket);
  });

  function handleDisconnect(socket) {
    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null;
      console.log(`🧹 清除等待狀態: ${socket.id}`);
    }

    if (socket.partner) {
      console.log(`🔄 通知 partner (${socket.partner.id}) 離線`);
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
    }

    socket.partner = null;
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server 正在執行 http://localhost:${PORT}`);
});
