const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// 提供前端 public 目錄中的靜態資源
app.use(express.static(path.join(__dirname, "public")));

let waitingUser = null;

io.on("connection", (socket) => {
  console.log(`🟢 使用者已連線: ${socket.id}`);

  socket.partner = null;

  socket.on("join", () => {
    console.log(`👋 ${socket.id} 請求配對`);

    // 避免重複進入等待佇列
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
    console.log(`❄️ ${socket.id} 傳送 ICE 候選`);
    if (socket.partner) {
      socket.partner.emit("ice-candidate", candidate);
    } else {
      console.log("⚠️ 尚未配對成功，無法傳送 ICE");
    }
  });

  socket.on("manual-leave", () => {
    console.log(`🚪 ${socket.id} 主動離開聊天室`);
    cleanup(socket);
  });

  socket.on("disconnect", () => {
    console.log(`🔴 ${socket.id} 離線`);
    cleanup(socket);
  });

  function cleanup(socket) {
    if (waitingUser && waitingUser.id === socket.id) {
      console.log(`🧹 移除等待中的 ${socket.id}`);
      waitingUser = null;
    }

    if (socket.partner) {
      console.log(`🔁 通知 ${socket.partner.id} 對方已離線`);
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
    }

    socket.partner = null;
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
