const EventEmitter = require("events");

const fileEvents = new EventEmitter();

// Event Listeners
fileEvents.on("FILE_UPLOADED", (data) => {
  console.log(`[Event] File uploaded: ${data.filename} (User: ${data.userId || "anonymous"})`);
});

fileEvents.on("FILE_DOWNLOADED", (data) => {
  console.log(`[Event] File downloaded: ${data.filename || data.fileId}`);
});

fileEvents.on("FILE_DELETED", (data) => {
  console.log(`[Event] File deleted: ${data.filename || data.fileId}`);
});

module.exports = fileEvents;
