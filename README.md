# Anam AI Avatar Demo

Full-stack sample that issues session tokens through a lightweight Express backend and streams an Anam avatar inside a React/Vite frontend.

## Prerequisites

- Node.js 18+ and npm
- An active Anam account and API key

## Backend (`backend/`)

1. Copy the example environment file and add your key:
   ```powershell
   cd backend
   copy .env.example .env
   ```
   Update `ANAM_API_KEY` with your credential and adjust `PORT` (default `4000`) if needed.
2. Install dependencies (already done if you ran `npm install`, but safe to repeat):
   ```powershell
   npm install
   ```
3. Start the server:
   ```powershell
   npm run dev     # with nodemon
   # or
   npm start       # single-run
   ```

The backend exposes `POST /api/anam/session-token`, forwarding the provided `personaConfig` to Anam and returning a session token.

## Frontend (`frontend/`)

1. Install dependencies:
   ```powershell
   cd frontend
   npm install
   ```
2. Start the dev server:
   ```powershell
   npm run dev
   ```
   Vite runs on `http://localhost:5173` by default and proxies `/api` calls to `http://localhost:4000`.

## Persona Configuration

`frontend/src/App.jsx` includes placeholder values for `personaId`, `voiceId`, and `systemPrompt`. Replace these with real values from your Anam dashboard.

## Project Structure

```
backend/
  index.js
  package.json
  .env.example
frontend/
  src/
    App.jsx
    AnamAvatar.jsx
    main.jsx
  vite.config.js
  package.json
README.md
```

With both servers running, click **Start Avatar** in the web UI to request a token and begin streaming the avatar. If streaming fails, check the browser console and backend logs for detailed errors.

