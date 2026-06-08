const multer = require("multer");
const path = require("path");
const fs = require("fs")

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../public/uploads");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(
      null,
      uniqueName + path.extname(file.originalname)
    );
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    ".pdf",
    ".doc",
    ".docx",
    ".zip",
    ".rar",
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("File type not allowed"), false);
  }
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Export helper
const uploadSingle = (fieldName) =>
  upload.single(fieldName);

module.exports = {
  uploadSingle,
};