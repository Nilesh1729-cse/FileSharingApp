const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const File = require("../models/File");
const auth = require("../middleware/auth");
const fileEvents = require("../events/fileEvents");

const router = express.Router();

// Upload Directory & Metadata Store
const uploadDir = path.join(__dirname, "../uploads");
const metadataFile = path.join(uploadDir, "metadata.json");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Persistent File Metadata Helpers
function loadMetadata() {
  if (fs.existsSync(metadataFile)) {
    try {
      const data = fs.readFileSync(metadataFile, "utf-8");
      return JSON.parse(data);
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveMetadata(meta) {
  try {
    fs.writeFileSync(metadataFile, JSON.stringify(meta, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving metadata.json:", e.message);
  }
}

// Sync existing disk files into metadata on initialization
function syncExistingDiskFiles() {
  const meta = loadMetadata();
  const diskFiles = fs.readdirSync(uploadDir);

  diskFiles.forEach((file) => {
    if (file === "metadata.json" || file.startsWith(".")) return;
    
    // Check if already indexed
    const alreadyIndexed = Object.values(meta).some((item) => item.filename === file);
    if (!alreadyIndexed) {
      const stats = fs.statSync(path.join(uploadDir, file));
      let origName = file;
      let fileId = "";

      if (file.includes("___")) {
        const parts = file.split("___");
        fileId = parts[0];
        origName = parts.slice(1).join("___");
      } else if (/^\d+-\d+-/.test(file)) {
        fileId = "f-" + file.replace(/\.[^/.]+$/, "");
        origName = file.replace(/^\d+-\d+[-_]/, "") || file;
      } else {
        fileId = "f-" + Math.random().toString(36).substr(2, 9);
      }

      meta[fileId] = {
        _id: fileId,
        id: fileId,
        filename: file,
        originalName: origName,
        name: origName,
        path: path.join(uploadDir, file),
        size: stats.size,
        mimetype: file.endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
        category: getFileCategory(origName),
        owner: "guest",
        status: "available",
        isStarred: false,
        isPublic: true,
        downloads: 0,
        createdAt: stats.birthtime ? stats.birthtime.toISOString() : new Date().toISOString(),
      };
    }
  });

  saveMetadata(meta);
}

syncExistingDiskFiles();

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const fileId = "f-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    req.generatedFileId = fileId;
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${fileId}___${safeName}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

// Helper to determine category
function getFileCategory(filename, mimetype = "") {
  const ext = filename.split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext) || mimetype.startsWith("image/")) return "images";
  if (["pdf", "doc", "docx", "txt", "rtf", "odt", "xls", "xlsx", "ppt", "pptx", "csv"].includes(ext) || mimetype.includes("pdf") || mimetype.includes("word") || mimetype.includes("sheet")) return "documents";
  if (["mp4", "mov", "avi", "mkv", "mp3", "wav", "flac"].includes(ext) || mimetype.startsWith("video/") || mimetype.startsWith("audio/")) return "media";
  if (["zip", "rar", "tar", "gz", "7z", "iso"].includes(ext) || mimetype.includes("zip") || mimetype.includes("compressed")) return "archives";
  return "other";
}

// @route   POST /api/files/upload
// @desc    Upload single file & save physical binary permanently
// @access  Public / Private
router.post("/upload", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileId = req.generatedFileId || ("f-" + Date.now().toString(36));
    const category = getFileCategory(req.file.originalname, req.file.mimetype);

    const fileData = {
      _id: fileId,
      id: fileId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      name: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype || "application/octet-stream",
      category,
      owner: req.user?.id || "guest",
      status: "available",
      isStarred: false,
      isPublic: true,
      downloads: 0,
      createdAt: new Date().toISOString(),
    };

    // Save to persistent metadata
    const meta = loadMetadata();
    meta[fileId] = fileData;
    saveMetadata(meta);

    // Save to MongoDB if available
    if (mongoose.connection.readyState === 1) {
      try {
        const dbFile = new File({
          filename: req.file.filename,
          originalName: req.file.originalname,
          path: req.file.path,
          size: req.file.size,
          mimetype: req.file.mimetype,
          category,
          owner: mongoose.Types.ObjectId.isValid(req.user?.id) ? req.user.id : new mongoose.Types.ObjectId(),
          status: "available",
        });
        await dbFile.save();
      } catch (dbErr) {
        console.warn("MongoDB save warning:", dbErr.message);
      }
    }

    // Trigger upload event
    fileEvents.emit("FILE_UPLOADED", {
      fileId: fileData.id,
      filename: fileData.originalName,
      userId: req.user?.id,
    });

    res.status(201).json({
      message: "File uploaded successfully",
      file: fileData,
    });
  } catch (error) {
    console.error("File Upload Error:", error);
    res.status(500).json({ message: "Error uploading file", error: error.message });
  }
});

// @route   GET /api/files
// @desc    Get all files
// @access  Public / Private
router.get("/", auth, async (req, res) => {
  try {
    const meta = loadMetadata();
    let files = Object.values(meta).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ files });
  } catch (error) {
    console.error("Get Files Error:", error);
    res.status(500).json({ message: "Error fetching files", error: error.message });
  }
});

// @route   GET /api/files/:id
// @desc    Get file details
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const meta = loadMetadata();
    let file = meta[id];

    if (!file) {
      // Find by matching filename prefix or originalName
      file = Object.values(meta).find((f) => f.filename.includes(id) || f.originalName === id);
    }

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    res.json({ file });
  } catch (error) {
    console.error("Get File Details Error:", error);
    res.status(500).json({ message: "Error fetching file details", error: error.message });
  }
});

// @route   GET /api/files/download/:id
// @desc    Download authentic physical file by ID or filename
// @access  Public
router.get("/download/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const meta = loadMetadata();
    let file = meta[id];

    if (!file) {
      file = Object.values(meta).find((f) => f.filename.includes(id) || f.originalName === id);
    }

    // Direct disk search if not in metadata
    let filePath = file ? file.path : null;
    let downloadName = file ? file.originalName : null;

    if (!filePath || !fs.existsSync(filePath)) {
      const diskFiles = fs.readdirSync(uploadDir);
      const matched = diskFiles.find((f) => f.startsWith(id) || f.includes(id) || f === id);
      if (matched) {
        filePath = path.join(uploadDir, matched);
        downloadName = matched.includes("___") ? matched.split("___").slice(1).join("___") : matched.replace(/^\d+-\d+[-_]/, "");
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Physical file binary not found on server disk" });
    }

    // Increment downloads count in metadata
    if (file && meta[file.id]) {
      meta[file.id].downloads = (meta[file.id].downloads || 0) + 1;
      saveMetadata(meta);
    }

    // Trigger download event
    fileEvents.emit("FILE_DOWNLOADED", {
      fileId: id,
      filename: downloadName || path.basename(filePath),
    });

    const finalDownloadName = downloadName || path.basename(filePath);
    res.download(filePath, finalDownloadName);
  } catch (error) {
    console.error("Download Error:", error);
    res.status(500).json({ message: "Error downloading file", error: error.message });
  }
});

// @route   DELETE /api/files/:id
// @desc    Delete a file
// @access  Public / Private
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const meta = loadMetadata();
    const file = meta[id];

    if (file && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {}
    }
    delete meta[id];
    saveMetadata(meta);

    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
      await File.findByIdAndDelete(id).catch(() => {});
    }

    res.json({ message: "File deleted successfully", fileId: id });
  } catch (error) {
    res.status(500).json({ message: "Error deleting file", error: error.message });
  }
});

module.exports = router;
