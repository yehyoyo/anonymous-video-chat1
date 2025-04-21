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
const userPartners = new Map(); // 儲存 socket.id ↔ partnerId 對應

io.on("connection", (socket) => {
  console.log("🟢 使用者已連線:", socket.id);

  socket.on("join", () => {
    if (waitingUser && waitingUser.id !== socket.id) {
      // 配對兩人
      const partner = waitingUser;
      waitingUser = null;

      userPartners.set(socket.id, partner.id);
      userPartners.set(partner.id, socket.id);

      socket.emit("ready", partner.id);
      partner.emit("ready", socket.id);
    } else {
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
    const partnerId = userPartners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("ice-candidate", candidate);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 使用者離線:", socket.id);

    // 若在等待中則移除
    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null;
    }

    // 通知 partner
    const partnerId = userPartners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("disconnect");
      userPartners.delete(partnerId);
      userPartners.delete(socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
