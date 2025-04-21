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
  console.log(`🟢 使用者已連線: ${socket.id}`);
  socket.partner = null;

  socket.on("join", () => {
    console.log(`➡️ ${socket.id} 請求配對`);

    if (waitingUser === socket) {
      waitingUser = null;
    }

    if (waitingUser && waitingUser.id !== socket.id) {
      // 成功配對
      socket.partner = waitingUser;
      waitingUser.partner = socket;

      console.log(`✅ 配對成功: ${socket.id} <--> ${waitingUser.id}`);

      socket.emit("ready", waitingUser.id);
      waitingUser.emit("ready", socket.id);

      waitingUser = null;
    } else {
      // 尚無人等待，加入等待池
      waitingUser = socket;
      console.log(`⏳ ${socket.id} 等待配對中...`);
    }
  });

  socket.on("offer", ({ to, sdp }) => {
    console.log(`📤 ${socket.id} 發送 offer 給 ${to}`);
    io.to(to).emit("offer", { from: socket.id, sdp });
  });

  socket.on("answer", ({ to, sdp }) => {
    console.log(`📥 ${socket.id} 回覆 answer 給 ${to}`);
    io.to(to).emit("answer", { sdp });
  });

  socket.on("ice-candidate", (candidate) => {
    if (socket.partner) {
      console.log(`❄️ ${socket.id} ICE 候選 → ${socket.partner.id}`);
      socket.partner.emit("ice-candidate", candidate);
    } else {
      console.warn(`⚠️ ICE 候選傳送失敗，${socket.id} 尚無 partner`);
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

  function handleDisconnect(socket) {
    if (waitingUser && waitingUser.id === socket.id) {
      console.log(`🧹 清除等待中的使用者: ${socket.id}`);
      waitingUser = null;
    }

    if (socket.partner) {
      console.log(`🧨 通知 ${socket.partner.id}：partner ${socket.id} 已離線`);
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
    }

    socket.partner = null;
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server 正在執行: http://localhost:${PORT}`);
});
