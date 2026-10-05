# Deploy Cheese Mice as its own project

Repository: https://github.com/basevrzo60-design/cheese-mice

This repository contains only the Cheese Mice game. Deploy it using a NEW Vercel project and a NEW Render project/service. Do not connect it to the existing Dying Message or PINKO POS services.

## Vercel (frontend)

- Repository: basevrzo60-design/cheese-mice, branch main
- Root Directory: repository root
- Framework: Vite
- Install Command: npm ci --include=dev
- Build Command: npm run build:client
- Output Directory: dist
- Environment: VITE_SERVER_URL=https://YOUR-NEW-CHEESE-MICE-SERVER.onrender.com

The configuration is in vercel.json. VITE_SERVER_URL is public and embedded at build time. Redeploy Vercel when this URL changes.

## Render (backend)

- Create a NEW project named Cheese Mice and a NEW web service named cheese-mice-server
- Repository: basevrzo60-design/cheese-mice, branch main
- Build Command: npm ci --include=dev && npm run build:server
- Start Command: npm start
- Health Check Path: /health
- Environment: NODE_ENV=production, CLIENT_ORIGIN=https://YOUR-NEW-CHEESE-MICE.vercel.app
- Node version: 22
- Socket.IO namespace: /cheese

Use one server instance. Rooms are stored in memory and disappear when the server restarts or deploys. CLIENT_ORIGIN can include multiple exact domains separated by commas.

## Verify

Open the new backend's /health endpoint and check for {"ok":true}. Open the NEW Vercel URL and confirm Cheese Mice is online. Create a test room, join from another device, and verify reconnect and voting. Existing projects must retain their own repositories and URLs.
