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
  console.log("使用者已連線:", socket.id);

  socket.on("join", () => {
    if (waitingUser) {
      // 有人正在等，配對他們
      socket.partner = waitingUser;
      waitingUser.partner = socket;

      socket.emit("ready", waitingUser.id);
      waitingUser.emit("ready", socket.id);

      waitingUser = null;
    } else {
      // 沒人等，自己先等
      waitingUser = socket;
    }
  });

  socket.on("offer", ({ to, sdp }) => {
    io.to(to).emit("offer", { from: socket.id, sdp });
  });

  socket.on("answer", ({ to, sdp }) => {
    io.to(to).emit("answer", { sdp });
  });

  socket.on("ice-candidate", (candidate) => {
    if (socket.partner) {
      socket.partner.emit("ice-candidate", candidate);
    }
  });

  socket.on("disconnect", () => {
    console.log("使用者離線:", socket.id);
    if (waitingUser === socket) {
      waitingUser = null;
    }
    if (socket.partner) {
      socket.partner.emit("disconnect");
      socket.partner.partner = null;
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
