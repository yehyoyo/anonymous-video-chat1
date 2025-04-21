const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// 提供前端 static 目錄（index.html）
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
      socket.partner = waitingUser;
      waitingUser.partner = socket;

      socket.emit("ready", waitingUser.id);
      waitingUser.emit("ready", socket.id);

      console.log(`✅ 配對完成: ${socket.id} <--> ${waitingUser.id}`);

      waitingUser = null;
    } else {
      waitingUser = socket;
      console.log(`⏳ ${socket.id} 等待中...`);
    }
  });

  socket.on("offer", ({ to, sdp }) => {
    console.log(`📨 ${socket.id} -> ${to} 發送 offer`);
    io.to(to).emit("offer", { from: socket.id, sdp });
  });

  socket.on("answer", ({ to, sdp }) => {
    console.log(`📨 ${socket.id} -> ${to} 回覆 answer`);
    io.to(to).emit("answer", { sdp });
  });

  socket.on("ice-candidate", (candidate) => {
    if (socket.partner) {
      console.log(`❄️ ${socket.id} 傳送 ICE candidate 給 ${socket.partner.id}`);
      socket.partner.emit("ice-candidate", candidate);
    } else {
      console.log(`⚠️ ${socket.id} 嘗試發送 ICE，但尚未配對成功`);
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
      console.log(`🧹 ${socket.id} 從等待佇列移除`);
      waitingUser = null;
    }

    if (socket.partner) {
      console.log(`🔔 通知 ${socket.partner.id} 其對象 ${socket.id} 已離開`);
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
    }

    socket.partner = null;
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
