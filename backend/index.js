const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();
const app = express();

// =========================================================================
// 🔥 1. CẤU HÌNH CORS TOÀN DIỆN - TỰ ĐỘNG XỬ LÝ OPTIONS (PREFLIGHT)
// =========================================================================
app.use(
  cors({
    origin: true, // Chấp nhận TẤT CẢ mọi nguồn gửi tới (bao gồm cả Deploy Preview 34)
    credentials: true, // Cho phép truyền mã Token Cookie xác thực
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    preflightContinue: false, // 🌟 THÀNH PHẦN QUYẾT ĐỊNH: Tự động trả về 204 No Content cho request OPTIONS mà không cần gọi app.options()
    optionsSuccessStatus: 204,
  }),
);

// 🛠️ GIA CỐ PHÒNG THỦ: Ép trả về thành công ngay lập tức cho request OPTIONS (Preflight)
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    return res.sendStatus(200); // Trả về 200 OK ngay lập tức, giải phóng hàng đợi cho request GET/POST phía sau
  }
  next();
});

app.use(express.json());

// Middleware log request để theo dõi dưới bảng Console
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// =========================================================================
// 🔥 2. BỘ LỌC BẮC CẦU: Tự động chèn /api nếu Frontend cũ gọi thiếu
// =========================================================================
app.use((req, res, next) => {
  if (
    !req.url.startsWith("/api") &&
    !req.url.startsWith("/uploads") &&
    req.url !== "/"
  ) {
    req.url = "/api" + req.url;
  }
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// =========================================================================
// 3. HỆ THỐNG ROUTES
// =========================================================================
// API dùng chung
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));

// API quản lý (Admin / Giảng viên)
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/admin/thesis", require("./routes/thesis.routes"));
app.use("/api/lecturer", require("./routes/lecturer.routes"));

// API Đồ án, Nộp bài, Tiến độ (Chung & Sinh viên)
app.use("/api/student", require("./routes/student.routes"));
app.use("/api/thesis", require("./routes/thesis.routes"));
app.use("/api/milestones", require("./routes/milestone.routes"));
app.use("/api/submissions", require("./routes/submission.routes"));
// 🔥 TƯƠNG THÍCH NGƯỢC: Một số phiên bản Frontend cũ (và FE Netlify hiện tại)
// vẫn đang gọi đường dẫn SINGULAR "/api/submission". Mount thêm route này
// trỏ về cùng bộ controller để tránh 404 — KHÔNG ảnh hưởng tới role admin/lecturer.
app.use("/api/submission", require("./routes/submission.routes"));
app.use("/api/progress", require("./routes/progress.routes"));

app.use("/api/topics", require("./routes/topic.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));
app.use("/api/comments", require("./routes/comment.routes"));

app.get("/", (req, res) => {
  res.send("API đang chạy...");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
