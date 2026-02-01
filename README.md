# Money Tracker

A cross-platform expense tracking application built with React, Express, and Capacitor.

## Architecture

This is a monorepo with separate frontend and backend applications:

- `frontend/` - React application (runs on web, iOS, Android)
- `backend/` - Express API server
- Root configuration for Capacitor mobile builds

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Install root dependencies:
   ```bash
   npm install
   ```

2. Install workspace dependencies:
   ```bash
   npm run install:all
   ```

### Running the Application

**Development Mode (recommended for development):**
```bash
npm run dev
```
This starts both backend (port 3001) and frontend (port 3000) concurrently.

**Individual Services:**

Start backend only:
```bash
cd backend && npm run dev
# Or from root:
npm run dev --workspace=backend
```

Start frontend only:
```bash
cd frontend && npm run dev
# Or from root:
npm run dev --workspace=frontend
```

### Mobile Development

1. Build and sync Capacitor:
   ```bash
   npm run cap:sync
   ```

2. Open in Xcode (iOS):
   ```bash
   npm run cap:ios
   ```

3. Open in Android Studio (Android):
   ```bash
   npm run cap:android
   ```

## Project Structure

```
money-tracker/
├── capacitor.config.ts      # Capacitor configuration
├── package.json            # Root workspace configuration
├── frontend/               # React frontend
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   └── dist/               # Build output (webDir for Capacitor)
├── backend/                # Express backend
│   ├── package.json
│   ├── src/
│   └── dist/               # Build output
└── README.md
```

## Scripts

### Root Scripts
- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build frontend for production
- `npm run cap:sync` - Sync Capacitor with latest build
- `npm run cap:ios` - Open iOS project
- `npm run cap:android` - Open Android project

### Frontend Scripts
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Backend Scripts
- `npm run dev` - Start with ts-node-dev (auto-restart)
- `npm run build` - Compile TypeScript
- `npm run start` - Run compiled JavaScript

## Environment Variables

Create `.env` files in respective directories as needed:

- `backend/.env` - Backend environment variables
- `frontend/.env` - Frontend environment variables

## Development Workflow

1. **Backend First**: Start backend API server
2. **Frontend Second**: Start frontend development server
3. **Test Integration**: Frontend connects to backend API
4. **Mobile Testing**: Use Capacitor commands for mobile testing

## Ports

- Frontend (Vite): http://localhost:3000
- Backend (Express): http://localhost:3001