const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
    },

    originalName: {
      type: String,
      required: true,
    },

    path: {
      type: String,
      required: true,
    },

    size: {
      type: Number,
      required: true,
    },

    mimetype: {
      type: String,
      default: "application/octet-stream",
    },

    category: {
      type: String,
      enum: ["documents", "images", "media", "archives", "other"],
      default: "other",
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isStarred: {
      type: Boolean,
      default: false,
    },

    isPublic: {
      type: Boolean,
      default: true,
    },

    downloads: {
      type: Number,
      default: 0,
    },

    permissions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },

        access: {
          type: String,
          enum: ["read", "write"],
          default: "read",
        },
      },
    ],

    status: {
      type: String,
      enum: ["uploading", "available", "failed"],
      default: "available",
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model("File", fileSchema);
