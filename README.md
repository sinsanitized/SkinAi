# SkinAI 🧴

SkinAI is an AI-powered web app that analyzes an uploaded **face photo** and returns:
- **Skin type** estimate (with confidence)
- **Visible concerns** (acne, redness, PIH/PIE, texture, etc.)
- **Ingredient recommendations** (with cautions)
- **Korean-skincare-leaning product picks**
- A simple **AM/PM routine**
- **Ingredient conflict detection** (e.g., retinoids + acids same night)

> ⚠️ SkinAI is **not medical advice** and cannot diagnose conditions. Lighting, camera, and makeup can change results.

## Monorepo structure

- `apps/web` — React + Vite frontend
- `apps/api` — Express + TypeScript backend (OpenAI vision)
- `packages/shared-types` — shared TypeScript types
- `packages/utils` — shared helpers

## Setup

### Prerequisites
- Node.js v18+
- OpenAI API key
- (Optional) MongoDB
- (Optional) Pinecone index + key

### Install
```bash
npm install
```

### Environment variables

Create `apps/api/.env`:

```bash
PORT=3000
NODE_ENV=development
OPENAI_API_KEY=...
# Optional
MONGO_URI=...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=...
```

### Run
```bash
npm run dev
```

Frontend: `http://localhost:5173`  
API: `http://localhost:3000`

## API

- `GET /api/health`
- `POST /api/skin/analyze` (multipart form-data)
  - `image` (file) required
  - `goals` (string) optional
  - `budget` ("Drugstore" | "Mid" | "Premium") optional
  - `fragranceFree` (boolean) optional
  - `pregnancySafe` (boolean) optional
  - `sensitiveMode` (boolean) optional
