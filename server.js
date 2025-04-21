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
    if (waitingUser === socket) {
      console.log(`⚠️ ${socket.id} 已在等待中佇列，略過`);
      return;
    }

    // 若剛好有等待中使用者，配對他們
    if (waitingUser && waitingUser.id !== socket.id) {
      socket.partner = waitingUser;
      waitingUser.partner = socket;

      socket.emit("ready", waitingUser.id);
      waitingUser.emit("ready", socket.id);

      console.log(`✅ 配對成功: ${socket.id} <==> ${waitingUser.id}`);
      waitingUser = null;
    } else {
      waitingUser = socket;
      console.log(`⏳ ${socket.id} 加入等待中...`);
    }
  });

  socket.on("offer", ({ to, sdp }) => {
    console.log(`📨 ${socket.id} 發送 offer 給 ${to}`);
    io.to(to).emit("offer", { from: socket.id, sdp });
  });

  socket.on("answer", ({ to, sdp }) => {
    console.log(`📩 ${socket.id} 回覆 answer 給 ${to}`);
    io.to(to).emit("answer", { sdp });
  });

  socket.on("ice-candidate", (candidate) => {
    console.log(`❄️  ${socket.id} 傳送 ICE 候選`);
    if (socket.partner) {
      socket.partner.emit("ice-candidate", candidate);
    } else {
      console.log(`⚠️  ${socket.id} 沒有配對對象，ICE 不處理`);
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
      waitingUser = null;
      console.log(`🗑️ 移除等待佇列中的 ${socket.id}`);
    }

    if (socket.partner) {
      console.log(`🔄 通知 ${socket.partner.id} 對方 ${socket.id} 離開`);
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
    }

    socket.partner = null;
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
