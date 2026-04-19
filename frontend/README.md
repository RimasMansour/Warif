# Warif — Frontend

React 19 + Vite + Tailwind CSS dashboard for the Warif smart greenhouse management system.

## Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/           # Generic base components: Button, Card, Badge, Modal…
│   │   ├── layout/       # Sidebar, Navbar, PageShell
│   │   ├── charts/       # Line charts, gauges, heatmaps for sensor data
│   │   ├── sensors/      # SensorCard, SensorGrid, ReadingBadge
│   │   └── alerts/       # AlertBanner, AlertList, AlertItem
│   ├── pages/            # Dashboard, Sensors, Alerts, Trays, ML, Settings
│   ├── hooks/            # useAlerts, useSensors, useAuth, useWebSocket…
│   ├── services/         # api.js — all HTTP calls to the backend
│   ├── store/            # Global state (React Context or Zustand)
│   ├── utils/            # formatDate, formatSensorValue, cn(), …
│   ├── types/            # JSDoc types / TypeScript interfaces
│   └── main.jsx          # App entry point
├── public/
├── .env.example
├── Dockerfile
├── package.json
└── vite.config.js
```

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL (e.g. `http://localhost:8010`) |
| `VITE_WS_URL`  | WebSocket URL for live sensor updates |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
