# CloudShare File Sharing App

CloudShare is a browser-based file-sharing application. It lets people sign in, upload files, see them in a dashboard, organize them, create a share link, and download them again.

It is designed as a learning/demo project. It has a polished user interface and a Node.js API for storing and downloading files.

## What a non-technical user can do

1. Open the app's home page.
2. Create an account or use the demo sign-in screen.
3. Go to the dashboard.
4. Drag and drop a file, or choose one from the computer.
5. Find files using search or category filters.
6. Mark a file as starred, rename it in the dashboard, download it, delete it, or copy a share link.
7. Open a share link to view file information and download the shared file.

Supported categories include documents, images, videos/audio, archives, and other files. The upload limit set by the backend is 500 MB per file.

## How the app works

```text
Browser pages (HTML/CSS/JavaScript)
        |
        | Upload / download requests
        v
Node.js + Express API
        |
        +--> Uploaded file binary: backend/uploads/
        +--> File metadata: backend/uploads/metadata.json
        +--> MongoDB: optional additional storage for users and file records
```

The browser also keeps dashboard data in local storage and file copies in IndexedDB. This lets the interface demonstrate file management even when a backend download is unavailable.

## Technology used

### Frontend

- HTML, CSS, and vanilla JavaScript
- Bootstrap 5 and Bootstrap Icons for the interface
- `localStorage` for browser-side user and dashboard data
- IndexedDB for browser-side file blobs

### Backend

- Node.js
- Express for HTTP API routes
- Multer for handling file uploads
- MongoDB and Mongoose for optional database persistence
- JSON Web Tokens (JWT) and bcryptjs for authentication support
- Socket.IO for real-time file event notifications
- CORS and dotenv for request and environment configuration

## Project structure

```text
FileSharingApp-main/
├── frontend/                 # Pages, styling, and browser-side app logic
│   ├── index.html            # Landing page
│   ├── login.html            # Login screen
│   ├── register.html         # Registration screen
│   ├── dashboard.html        # File dashboard
│   ├── share.html            # Shared-file page
│   ├── download.html         # Download page
│   ├── app.js                # Frontend behavior
│   └── style.css             # Frontend styling
└── backend/                  # Node.js API
    ├── index.js              # Server entry point
    ├── routes/               # Authentication and file API routes
    ├── models/               # MongoDB user and file schemas
    ├── middleware/           # JWT middleware
    ├── uploads/              # Uploaded files and metadata.json
    └── package.json          # Backend dependencies and commands
```

## Running the project

### Requirements

- Node.js (LTS recommended)
- MongoDB, if you want database-backed user/file records. The app can still store uploaded file metadata locally when MongoDB is unavailable.

### 1. Start MongoDB (optional but recommended)

If MongoDB is installed locally, start it in a separate terminal:

```powershell
mongod
```

By default, the backend uses `mongodb://localhost:27017/filesharingapp`.

For MongoDB Atlas or another database, set `MONGODB_URI` before starting the server:

```powershell
$env:MONGODB_URI = "your-mongodb-connection-string"
```

### 2. Start the backend

From the repository's outer folder, run:

```powershell
cd .\FileSharingApp-main\backend
npm install
$env:PORT = 5001
npm start
```

The frontend expects the API at `http://localhost:5001/api`, so use port `5001`.

Check that it started successfully at:

```text
http://localhost:5001/api/health
```

### 3. Open the frontend

Open `frontend/index.html` in a browser, or serve the `frontend` folder with VS Code Live Server.

## API overview

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/register` | Create a backend user and return a JWT |
| `POST /api/auth/login` | Sign in with backend credentials and return a JWT |
| `GET /api/auth/me` | Get the authenticated user's profile |
| `POST /api/files/upload` | Upload one file |
| `GET /api/files` | List files |
| `GET /api/files/:id` | Get information about one file |
| `GET /api/files/download/:id` | Download a file |
| `DELETE /api/files/:id` | Delete a file |
| `GET /api/health` | Confirm that the API is running |

## Important note about access control

The data model includes an owner, a public/private flag, and a possible `read` or `write` permission per user. However, this demo currently does **not** enforce those permissions consistently:

- Missing or invalid API tokens are treated as a demo/guest user.
- File information and downloads are public endpoints.
- The delete route does not verify that the requester owns the file.
- Browser-side rename, star, and delete actions affect local browser data, not server-enforced permission rules.

Therefore, do not use this project as-is for sensitive or real multi-user file sharing. A production version should validate JWTs strictly and check file ownership or an explicit permission record before every read, update, and delete operation.

## Current limitations

- The frontend login/register screens currently simulate a logged-in session in the browser; they do not call the backend authentication endpoints.
- File sharing links do not yet grant per-user access or expire.
- There is no complete server-side edit/rename route.
- The frontend and backend maintain some state separately, so their displayed file lists may differ in demo usage.
