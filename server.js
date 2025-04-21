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
    console.log(`📨 使用者 ${socket.id} 請求配對`);

    if (waitingUser === socket) {
      console.log("⚠️ 重複加入等待佇列，忽略");
      return;
    }

    if (waitingUser && waitingUser.id !== socket.id) {
      console.log(`✅ 配對完成: ${waitingUser.id} <--> ${socket.id}`);

      socket.partner = waitingUser;
      waitingUser.partner = socket;

      socket.emit("ready", waitingUser.id);
      waitingUser.emit("ready", socket.id);

      waitingUser = null;
    } else {
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
      console.log(`🧊 ${socket.id} 傳送 ICE 候選`);
      socket.partner.emit("ice-candidate", candidate);
    } else {
      console.log(`🧊 ⚠️ ICE 候選未發送，${socket.id} 沒有配對對象`);
    }
  });

  socket.on("manual-leave", () => {
    console.log(`🚪 使用者 ${socket.id} 主動離開`);
    cleanupConnection(socket);
  });

  socket.on("disconnect", () => {
    console.log(`🔴 使用者 ${socket.id} 斷線`);
    cleanupConnection(socket);
  });

  function cleanupConnection(socket) {
    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null;
      console.log(`🧹 清除等待佇列中的 ${socket.id}`);
    }

    if (socket.partner) {
      console.log(`🔔 通知 ${socket.partner.id} 對方離開`);
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
    }

    socket.partner = null;
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
