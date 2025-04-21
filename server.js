// server.js
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
    console.log(`➡️ ${socket.id} 請求配對...`);

    if (waitingUser && waitingUser.id !== socket.id) {
      // 配對成功，指定 offerer / answerer
      socket.partner = waitingUser;
      waitingUser.partner = socket;

      socket.emit("ready", { partnerId: waitingUser.id, role: "offerer" });
      waitingUser.emit("ready", { partnerId: socket.id, role: "answerer" });

      console.log(`✅ 成功配對 ${socket.id}（offerer） <--> ${waitingUser.id}（answerer）`);

      waitingUser = null;
    } else {
      waitingUser = socket;
      console.log(`⏳ ${socket.id} 加入等待池中`);
    }
  });

  socket.on("offer", ({ to, sdp }) => {
    console.log(`📤 ${socket.id} 發送 offer 給 ${to}`);
    io.to(to).emit("offer", { from: socket.id, sdp });
  });

  socket.on("answer", ({ to, sdp }) => {
    console.log(`📥 ${socket.id} 發送 answer 給 ${to}`);
    io.to(to).emit("answer", { sdp });
  });

  socket.on("ice-candidate", (candidate) => {
    if (socket.partner) {
      console.log(`❄️  ${socket.id} 傳送 ICE 給 ${socket.partner.id}`);
      socket.partner.emit("ice-candidate", candidate);
    } else {
      console.log(`⚠️  ${socket.id} 沒有配對對象，丟棄 ICE`);
    }
  });

  socket.on("manual-leave", () => {
    console.log(`🚪 ${socket.id} 主動離線`);
    handleDisconnect(socket);
  });

  socket.on("disconnect", () => {
    console.log(`🔴 ${socket.id} 離線`);
    handleDisconnect(socket);
  });

  function handleDisconnect(socket) {
    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null;
    }

    if (socket.partner) {
      console.log(`🔁 通知 ${socket.partner.id}：對方 ${socket.id} 已離開`);
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
    }

    socket.partner = null;
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
