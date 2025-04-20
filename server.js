const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// 設定靜態資源路徑
app.use(express.static('public'));

// Socket.io 處理
io.on('connection', socket => {
  console.log('a user connected');
  // 加上你原本的 socket 處理邏輯
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
