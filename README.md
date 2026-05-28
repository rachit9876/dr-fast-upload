# Minimal Serverless File Uploader ☁️

A lightning-fast, ultra-minimal file hosting service built on **Cloudflare Pages** and **Cloudflare Workers**, using a **GitHub Repository** as a free serverless storage backend and CDN.

This version is stripped down to the absolute essentials: pure file uploading, base64 data transfer, and intelligent deduplication.

## ✨ Features

- **Ultra-Minimal UI**: A clean, centered, no-nonsense interface.
- **Zero Cost Hosting**: Leverages Cloudflare Pages (Free Tier) and GitHub for storage.
- **Smart Deduplication**: Calculates a SHA-256 hash of the file. If the file already exists in your repository, it skips the upload and instantly returns the existing URL.
- **Cross-Origin Ready**: Built-in CORS middleware allows you to use this API from other websites or CLI tools.
- **Direct File Serving**: Files are served directly through Cloudflare via `[file].js`.
- **24MB File Limit**: Enforced on the frontend to prevent browser freezing during base64 encoding.

## 📂 Folder Structure

```text
/
├── index.html
└── functions/
    ├── api/
    │   ├── _middleware.js  # Handles CORS for all API routes
    │   └── upload.js       # Handles deduplication and GitHub API PUT requests
    └── public/
        └── [file].js       # Fetches and serves raw files from GitHub