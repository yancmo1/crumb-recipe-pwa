# Crumb Recipe PWA - Product Requirements Document

**Version:** 1.0.0  
**Last Updated:** 2025-12-24  
**Status:** Living Document  

---

## Executive Summary

**Crumb** is a mobile-first Progressive Web App (PWA) designed for home cooks who want to manage and cook from recipes offline. The app focuses on simplicity, reliability, and offline-first functionality, allowing users to import recipes from any website, scale ingredients intelligently, and track cooking progress with an intuitive session-based interface.

### Key Value Propositions
- 📱 **Mobile-First Design** - Optimized for iPhone Safari with full PWA support
- 📴 **Offline-First** - Complete functionality without internet connection
- 🔄 **Intelligent Recipe Import** - Automatically extracts recipes from 75-85% of cooking websites
- ✅ **Cook Mode** - Track progress with ingredient and step checkboxes
- 🎯 **Recipe Scaling** - Smart fraction display for any serving size
- 🐘 **Multi-Device Sync** - Server-side storage with offline fallback

---

## 1. Product Overview

### 1.1 Vision & Goals

**Vision:** Create the most reliable offline recipe management tool for home cooks, prioritizing simplicity and functionality over complex features.

**Goals:**
- Provide a frictionless recipe import experience with high success rates (75-85%)
- Enable complete offline functionality for cooking without internet
- Deliver an intuitive cooking experience with persistent session management
- Support multi-device synchronization without requiring user accounts
- Maintain a clean, kitchen-friendly interface that works great on mobile devices

### 1.2 Target Users

**Primary Persona:**
- **Home Cook Hannah** - Cooks 3-5 times per week, uses recipes from various blogs, wants a simple way to save and access recipes offline, often cooks with phone in kitchen
- **Demographics:** Ages 25-55, comfortable with technology, values simplicity
- **Pain Points:** Browser bookmarks get lost, ads on recipe sites, need offline access, ingredient scaling is tedious

**Secondary Persona:**
- **Baking Enthusiast Ben** - Makes bread and complex recipes requiring precise measurements and multi-day processes
- **Needs:** Accurate ingredient scaling, session persistence across cooking sessions, ability to track progress on multi-step recipes

---

## 2. Core Features

### 2.1 Recipe Import ⭐ **HIGH PRIORITY**

**Description:** Automatically extract recipe content from URLs using intelligent parsing strategies.

**User Story:** As a user, I want to import a recipe from any cooking website by simply pasting the URL, so I can save it for offline use.

**Technical Implementation:**
- **Strategy 0: Recipe Plugin Detection** (70% of sites, 95% success)
  - WordPress Recipe Maker (WPRM)
  - Tasty Recipes
  - EasyRecipe/Ziplist
  - Cooked Plugin
  
- **Strategy 1: Enhanced JSON-LD** (Schema.org structured data)
  - Quality scoring and validation
  - Completeness checks (title, ingredients, instructions)
  
- **Strategy 2: Print Version Detection**
  - Smart URL pattern detection
  - Common print patterns: `/print/`, `?print=1`, `/wprm_print/`
  
- **Strategy 3: Improved Heuristics**
  - Multi-section header processing
  - Ingredient group preservation
  - Fallback for non-standard sites

**Acceptance Criteria:**
- ✅ Import succeeds for 75-85% of recipe URLs
- ✅ Extracts: title, author, image, ingredients, steps, times, servings
- ✅ Preserves section headers (e.g., "For Dough:", "For Filling:")
- ✅ Handles multi-section recipes correctly
- ✅ Provides useful error messages when import fails

**API Endpoint:** `POST /api/import`

**Related Files:**
- `server/extractors/plugins.js`
- `server/extractors/improved-extractor.js`
- `server/extractors/quality.js`

---

### 2.2 Recipe Library **HIGH PRIORITY**

**Description:** Browse, search, and organize saved recipes.

**User Story:** As a user, I want to see all my saved recipes in a grid view with images, so I can quickly find the recipe I want to cook.

**Features:**
- Grid layout with recipe cards (image, title, author, time)
- Search by recipe title
- Filter by category (Breakfast, Dinner, Desserts, Drinks)
- Filter by tags (custom user-defined)
- Sort by: Date Added (default), Favorites, Alphabetical
- Favorite recipes (displayed with ⭐ and sorted to top)

**Data Model:**
```typescript
Recipe {
  id: string;
  title: string;
  image?: string;
  author?: string;
  sourceName?: string;
  sourceUrl: string;
  category?: string;
  tags?: string[];
  isFavorite?: boolean;
  servings?: number;
  times?: { prep?: number; cook?: number; total?: number };
  ingredients: IngredientToken[];
  steps: string[];
  tips?: string[];
  notes?: string;
  nutrition?: NutritionInfo;
  createdAt: number;
  updatedAt: number;
}
```

**Acceptance Criteria:**
- ✅ Display all recipes in responsive grid (2 cols mobile, 3+ desktop)
- ✅ Show recipe image or placeholder if not available
- ✅ Search filters recipes in real-time
- ✅ Favorites appear at top of list
- ✅ Click recipe card navigates to detail view

**Page:** `src/pages/Library.tsx`

---

### 2.3 Cook Mode & Sessions **HIGH PRIORITY**

**Description:** Track cooking progress with checkboxes for ingredients and steps, with automatic session persistence.

**User Story:** As a user, I want to check off ingredients as I gather them and steps as I complete them, so I don't lose my place while cooking.

**Features:**
- **Start Cooking** button creates a new session
- Checkbox for each ingredient and step
- Session persists for 72 hours with auto-extension option
- Session status indicators: Active, Expiring (< 6 hours), Expired
- Recipe multiplier/scaling (0.5×, 1×, 1.5×, 2×, 3×, custom)
- Step timers with push notifications
- Floating timer widget for active timers
- Resume cooking from previous session

**Session Data Model:**
```typescript
CookSession {
  recipeId: string;
  checkedIngredients: Record<number, boolean>;
  checkedSteps: Record<number, boolean>;
  multiplier: number; // default: 1
  expiresAt: number; // epoch ms
}
```

**Storage:**
- Sessions stored in IndexedDB (client-side only)
- Not synced to server (intentional - device-specific cooking state)
- Automatic cleanup of expired sessions

**Acceptance Criteria:**
- ✅ Session creation with "Start Cooking" button
- ✅ Checkbox state persists across page reloads
- ✅ Session expires after 72 hours or when manually ended
- ✅ Warning shown when session is expiring (< 6 hours remaining)
- ✅ Option to extend session by 24 hours

**Page:** `src/pages/RecipeDetail.tsx`

---

### 2.4 Recipe Scaling **MEDIUM PRIORITY**

**Description:** Intelligently scale ingredient amounts with clean fraction display.

**User Story:** As a user, I want to scale a recipe to make more or less servings, with automatically adjusted ingredient amounts displayed as readable fractions.

**Features:**
- Preset multipliers: 0.5×, 1×, 1.5×, 2×, 3×
- Custom multiplier input
- Fraction.js for clean display (1.5 cups → 1 ½ cups)
- Scales all numeric amounts in ingredients
- Preserves non-numeric ingredients unchanged
- Optional gram conversion display

**Example:**
```
Original: 1 cup flour
Scaled (1.5×): 1 ½ cups flour

Original: 2 eggs
Scaled (0.5×): 1 egg
```

**Technical:**
- Uses `fraction.js` library for fractional display
- Ingredient parsing extracts amount, unit, item, note
- Scaling applies only to amount field

**Acceptance Criteria:**
- ✅ Multiplier buttons update all ingredient amounts
- ✅ Fractions display cleanly (no decimals like 1.333)
- ✅ Non-numeric ingredients remain unchanged
- ✅ Multiplier persists with cook session
- ✅ Original recipe unchanged in database

**Utility:** `src/utils/scale.ts`

---

### 2.5 Step Timers ⭐ **NEW FEATURE**

**Description:** Automatically detect time durations in recipe steps and provide one-tap timer functionality with push notifications.

**User Story:** As a user, I want to start a timer directly from a recipe step that mentions a duration (e.g., "Bake for 30 minutes"), so I don't have to manually set a separate timer.

**Features:**
- **Smart Duration Detection** - Parses steps for time expressions
  - Examples: "30 minutes", "1 hour", "2h 30m", "45 min"
  - Handles: hours, minutes, seconds, combinations
  
- **Inline Timer Buttons** - Appears in steps with detected durations
  - Shows parsed duration (e.g., "30 min")
  - One-click to start timer
  
- **Floating Timer Widget** - Active timers display in corner
  - Shows remaining time
  - Pause/resume controls
  - Cancel option
  - Handles multiple timers simultaneously
  
- **Push Notifications** - Alerts when timer completes
  - Requires user permission on first use
  - Works even if app is in background
  - Shows recipe name and step context

**Technical Implementation:**
- Duration extraction: `src/utils/stepTimers.ts`
- Push notification API: `src/utils/push.ts`
- Web Push protocol with VAPID keys
- Service worker handles background notifications

**Acceptance Criteria:**
- ✅ Detects time durations in step text
- ✅ Timer button appears next to detected durations
- ✅ Clicking timer starts countdown
- ✅ Floating widget shows active timers
- ✅ Push notification sent when timer completes
- ✅ Multiple timers can run simultaneously
- ✅ Timers persist across page navigation (within app)

**Components:**
- `src/components/StepTimer.tsx`
- `src/components/FloatingStepTimer.tsx`

---

### 2.6 Nutrition Information **MEDIUM PRIORITY**

**Description:** Display nutrition facts when available from recipe source.

**User Story:** As a user, I want to see nutrition information for recipes when available, so I can make informed dietary choices.

**Supported Fields:**
- Serving Size
- Calories (kcal)
- Total Fat (g)
- Saturated Fat (g)
- Trans Fat (g)
- Cholesterol (mg)
- Sodium (mg)
- Total Carbohydrates (g)
- Dietary Fiber (g)
- Sugars (g)
- Protein (g)

**Data Sources:**
- WPRM plugin (best support)
- Cooked plugin (limited)
- JSON-LD schema.org (future)

**Display:**
- Grid layout with cards
- Primary metrics highlighted (Calories, Protein, Carbs, Fat)
- Additional details below
- Only shown if data exists

**Acceptance Criteria:**
- ✅ Nutrition section appears when data available
- ✅ Clean, readable grid layout
- ✅ Per-serving values displayed
- ✅ No section shown if no nutrition data

**Type Definition:** `src/types.ts` → `NutritionInfo`

---

### 2.7 Offline Functionality **HIGH PRIORITY**

**Description:** Full app functionality without internet connection.

**User Story:** As a user, I want to access all my saved recipes and cooking features even when I don't have internet, so I can cook from anywhere.

**Features:**
- **Service Worker** - Caches app shell and assets
- **IndexedDB Cache** - Local storage for recipes
- **Offline Detection** - Automatic fallback to cache
- **Background Sync** - Syncs changes when connection restored
- **Update Notifications** - Prompts user when new version available

**Storage Strategy:**
- **Server (PostgreSQL)** - Primary storage, source of truth
- **API Layer (Express)** - REST endpoints for CRUD operations
- **Browser Cache (IndexedDB)** - Offline fallback, synced from server

**Data Flow:**
```
Import/Create → Server API → PostgreSQL → IndexedDB Cache
                    ↓
                If offline → IndexedDB only
```

**PWA Features:**
- Installable on Safari (mobile/tablet) and Android Chrome
- Proper manifest.json with icons
- Apple-specific meta tags for Safari (installed)
- Standalone display mode
- Safe area padding for notched devices

**Acceptance Criteria:**
- ✅ App loads and functions without internet
- ✅ Recipes cached locally after first load
- ✅ Changes sync to server when connection available
- ✅ Install prompt works on Safari and Android
- ✅ Update notification shows when new version deployed

**Related Files:**
- `src/db.ts` - Hybrid storage layer
- `src/sw.ts` - Service worker
- `vite.config.ts` - PWA plugin configuration
- `public/manifest.json` - PWA manifest

---

### 2.8 Settings & Data Management **MEDIUM PRIORITY**

**Description:** Manage app preferences and recipe data.

**User Story:** As a user, I want to export my recipes for backup and control app settings, so I don't lose my data.

**Features:**
- **Theme Selection** - Light, Dark, System
- **Session Settings**
  - Keep sessions on close
  - Auto-extend expiring sessions
  
- **Unit Preferences**
  - Prefer metric (grams) when available
  - Custom conversion overrides
  
- **Data Management**
  - Export all recipes (JSON download)
  - Import recipes (JSON upload)
  - Clear all data (with confirmation)
  
- **Server Sync**
  - Optional sync key for multi-device
  - Connection status indicator

**Export Format:**
```json
{
  "recipes": [...],
  "exportedAt": 1234567890,
  "version": "1.0.0"
}
```

**Acceptance Criteria:**
- ✅ Theme changes apply immediately
- ✅ Export downloads complete recipe collection
- ✅ Import merges recipes (update existing by ID)
- ✅ Clear data requires confirmation
- ✅ Settings persist across sessions

**Page:** `src/pages/Settings.tsx`

---

## 3. Technical Architecture

### 3.1 Technology Stack

**Frontend:**
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite (fast dev server, optimized builds)
- **Styling:** Tailwind CSS with custom kitchen color palette
- **State Management:** Zustand (lightweight, minimal boilerplate)
- **Routing:** React Router DOM v6
- **Storage:** Dexie (IndexedDB wrapper)
- **PWA:** Workbox via vite-plugin-pwa
- **UI Components:** Lucide React (icons), Sonner (toasts)

**Backend:**
- **Framework:** Express.js (ESM modules)
- **HTML Parsing:** Cheerio + @mozilla/readability
- **Database:** PostgreSQL (via `pg` library)
- **Ingredient Parsing:** fraction.js for measurements
- **Push Notifications:** web-push with VAPID keys

**Infrastructure:**
- **Container:** Docker (multi-stage build)
- **Registry:** GitHub Container Registry (GHCR)
- **Reverse Proxy:** Traefik (via central infra repo)
- **Database:** PostgreSQL in shared container
- **CI/CD:** GitHub Actions

### 3.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User's Device                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              React PWA (Vite)                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │  Pages   │  │  Zustand │  │  Service Worker  │  │  │
│  │  │  - Home  │  │  Stores  │  │  - Caching       │  │  │
│  │  │  - Recipe│  │          │  │  - Push Notifs   │  │  │
│  │  │  - Import│  │          │  │                  │  │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  │         │              │                             │  │
│  │         ▼              ▼                             │  │
│  │  ┌────────────────────────────────────────────┐    │  │
│  │  │      IndexedDB (Dexie)                     │    │  │
│  │  │  - Recipes Cache                           │    │  │
│  │  │  - Cook Sessions                           │    │  │
│  │  └────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          │ HTTPS                            │
│                          ▼                                  │
└──────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    Production Server                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Traefik (Reverse Proxy)                │    │
│  │        - HTTPS/TLS (Let's Encrypt)                  │    │
│  │        - Routing (crumb.yourdomain.com)             │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         Crumb Container (Node.js)                   │    │
│  │  ┌─────────────────────────────────────────────┐   │    │
│  │  │  Express Server (Port 5554)                 │   │    │
│  │  │  - REST API (/api/*)                        │   │    │
│  │  │  - Recipe Import                            │   │    │
│  │  │  - Static Files (Vite build)                │   │    │
│  │  │  - Health Check (/health)                   │   │    │
│  │  └─────────────────────────────────────────────┘   │    │
│  │              │                                      │    │
│  │              ▼                                      │    │
│  │  ┌─────────────────────────────────────────────┐   │    │
│  │  │  Recipe Extractors                          │   │    │
│  │  │  - Plugin Detection (WPRM, Tasty, etc.)    │   │    │
│  │  │  - JSON-LD Parser                           │   │    │
│  │  │  - Print Version Fetcher                    │   │    │
│  │  │  - Heuristic Fallback                       │   │    │
│  │  └─────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         PostgreSQL Container                        │    │
│  │  Database: crumb_db                                 │    │
│  │  Tables:                                            │    │
│  │    - recipes                                        │    │
│  │    - cook_sessions                                  │    │
│  │    - settings                                       │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Data Models

**Database Schema (PostgreSQL):**

```sql
-- Recipes table
CREATE TABLE recipes (
  id VARCHAR(255) PRIMARY KEY,
  title TEXT NOT NULL,
  image TEXT,
  author TEXT,
  source_name TEXT,
  source_url TEXT NOT NULL,
  category TEXT,
  tags JSONB,
  is_favorite BOOLEAN DEFAULT false,
  yield TEXT,
  servings INTEGER,
  times JSONB,
  ingredients JSONB NOT NULL,
  steps JSONB NOT NULL,
  tips JSONB,
  notes TEXT,
  nutrition JSONB,
  conversion_overrides JSONB,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_recipes_created_at ON recipes(created_at DESC);
CREATE INDEX idx_recipes_title ON recipes(title);
CREATE INDEX idx_recipes_category ON recipes(category);

-- Cook sessions table (for server-side storage if needed)
CREATE TABLE cook_sessions (
  recipe_id VARCHAR(255) PRIMARY KEY,
  checked_ingredients JSONB DEFAULT '{}',
  checked_steps JSONB DEFAULT '{}',
  multiplier REAL DEFAULT 1.0,
  expires_at BIGINT NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- Settings table (per-device or sync key)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at BIGINT NOT NULL
);
```

### 3.4 API Endpoints

**Base URL:** `http://localhost:5554` (dev) or `https://crumb.yourdomain.com` (prod)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/health` | Health check | - | `{status: "ok"}` |
| GET | `/api/recipes` | Get all recipes | - | `{success: true, recipes: [...]}` |
| GET | `/api/recipes/:id` | Get single recipe | - | `{success: true, recipe: {...}}` |
| POST | `/api/recipes` | Create recipe | Recipe object | `{success: true, recipe: {...}}` |
| PUT | `/api/recipes/:id` | Update recipe | Partial Recipe | `{success: true, recipe: {...}}` |
| DELETE | `/api/recipes/:id` | Delete recipe | - | `{success: true}` |
| POST | `/api/import` | Import from URL | `{url: string}` | `{success: true, recipe: {...}}` |
| GET | `/api/push/vapid-key` | Get VAPID public key | - | `{success: true, publicKey: "..."}` |
| POST | `/api/push/subscribe` | Subscribe to push | Subscription object | `{success: true}` |
| POST | `/api/push/schedule` | Schedule notification | Timer payload | `{success: true, id: "..."}` |
| POST | `/api/push/cancel` | Cancel scheduled push | `{id: string}` | `{success: true}` |

### 3.5 File Structure

```
crumb-recipe-pwa/
├── .github/
│   └── workflows/
│       └── build-push.yml          # CI/CD pipeline
├── public/
│   ├── manifest.json               # PWA manifest
│   ├── icons/                      # App icons
│   └── apple-touch-icon.png
├── server/
│   ├── index.js                    # Express server
│   ├── db.js                       # PostgreSQL connection
│   ├── extractors/
│   │   ├── plugins.js              # Recipe plugin detection
│   │   ├── improved-extractor.js   # Main extraction logic
│   │   └── quality.js              # Recipe quality scoring
│   └── test-imports.js             # Import test suite
├── src/
│   ├── api/
│   │   └── recipes.ts              # API client
│   ├── components/
│   │   ├── FloatingStepTimer.tsx   # Timer widget
│   │   ├── StepTimer.tsx           # Inline timer
│   │   └── ui/                     # Reusable UI components
│   ├── pages/
│   │   ├── Library.tsx             # Recipe list/grid
│   │   ├── RecipeDetail.tsx        # Recipe view + cook mode
│   │   ├── ImportRecipe.tsx        # Import form
│   │   └── Settings.tsx            # Settings page
│   ├── state/
│   │   └── session.ts              # Zustand stores
│   ├── utils/
│   │   ├── scale.ts                # Recipe scaling
│   │   ├── ingredients.ts          # Ingredient parsing
│   │   ├── stepTimers.ts           # Duration extraction
│   │   ├── push.ts                 # Push notifications
│   │   └── conversions.ts          # Unit conversions
│   ├── db.ts                       # Hybrid storage layer
│   ├── types.ts                    # TypeScript types
│   ├── App.tsx                     # Main app component
│   ├── main.tsx                    # Entry point
│   └── sw.ts                       # Service worker
├── Dockerfile                      # Multi-stage Docker build
├── docker-compose.yml              # Production compose
├── docker-compose.dev.yml          # Development compose
├── vite.config.ts                  # Vite + PWA config
├── tailwind.config.js              # Tailwind configuration
├── package.json                    # Dependencies
└── README.md                       # Documentation
```

### 3.6 Deployment Architecture

**Production Stack:**
- **Infrastructure Repo:** `modern-server-infra` (centralized orchestration)
- **Image Registry:** GitHub Container Registry (GHCR)
- **Image Tag:** `ghcr.io/yancmo1/crumb-recipe-pwa:latest`
- **Deployment Method:** Docker Compose (future: Docker Swarm/K8s)

**Deployment Flow:**
```
1. Developer pushes to main branch
2. GitHub Actions triggers build
3. Multi-stage Docker build:
   - Stage 1: Install dependencies
   - Stage 2: Build frontend (Vite)
   - Stage 3: Runtime (Node.js + built assets)
4. Image pushed to GHCR with tags: :latest, :sha-{commit}, :main
5. Infrastructure repo pulls new image
6. Docker Compose restarts service
7. Health check confirms deployment
```

**Environment Variables:**
```bash
# Server configuration
PORT=5554                           # Server port
NODE_ENV=production                 # Environment

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/crumb_db

# Push notifications (optional)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
```

**Health Checks:**
- Endpoint: `GET /health`
- Interval: 30 seconds
- Timeout: 3 seconds
- Retries: 3

**Resource Requirements:**
- CPU: 0.5-1 core
- Memory: 512MB-1GB
- Storage: 5GB (includes DB)

---

## 4. Deployment & Infrastructure

### 4.1 Local Development

**Prerequisites:**
- Node.js 20+
- npm 9+
- PostgreSQL 14+ (optional, for testing server storage)

**Development Modes:**

**Option 1: Frontend Only (Offline Mode)**
```bash
npm install
npm run dev
# Frontend: http://localhost:5173
# Uses IndexedDB only, no server API
```

**Option 2: Full Stack (Recommended)**
```bash
# Terminal 1: Start backend
npm run server
# API server: http://localhost:3000

# Terminal 2: Start frontend
npm run dev
# Frontend: http://localhost:5173
# Vite proxies /api requests to port 3000
```

**Option 3: Docker Development**
```bash
npm run docker:dev
# Frontend: http://localhost:5173
# Backend: http://localhost:5555
# PostgreSQL: localhost:5434
# Hot reload enabled for both frontend and backend
```

### 4.2 Testing

**Unit Tests:**
```bash
npm test                    # Run Vitest tests
npm test -- --watch         # Watch mode
```

**E2E Tests:**
```bash
npm run test:e2e           # Run Playwright tests
```

**Import Testing:**
```bash
node server/test-imports.js  # Test recipe import pipeline
```

**Manual Testing Checklist:**
- [ ] Import recipe from 3+ different sites
- [ ] Create cook session and check off items
- [ ] Scale recipe to different multipliers
- [ ] Start step timer and verify notification
- [ ] Test offline mode (network tab → offline)
- [ ] Export recipes and verify JSON
- [ ] Import recipes and verify merge
- [ ] Install as PWA on mobile device

### 4.3 Production Deployment

**Via Central Infrastructure Repo:**

The app is designed to be deployed through the `modern-server-infra` repository which handles:
- Traefik reverse proxy with automatic HTTPS
- PostgreSQL database (`crumb_db`)
- Monitoring and observability
- Centralized configuration

**Deployment Steps:**

1. **Build and Push Image** (automatic via GitHub Actions)
```bash
# Triggered on push to main branch
# Creates image: ghcr.io/yancmo1/crumb-recipe-pwa:latest
```

2. **Configure in Infrastructure Repo**
```yaml
# modern-server-infra/compose/docker-compose.yml
services:
  crumb:
    image: ghcr.io/yancmo1/crumb-recipe-pwa:latest
    container_name: crumb-recipe
    restart: unless-stopped
    environment:
      - PORT=5554
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      postgres:
        condition: service_healthy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.crumb.rule=Host(`crumb.yourdomain.com`)"
      - "traefik.http.routers.crumb.entrypoints=websecure"
      - "traefik.http.services.crumb.loadbalancer.server.port=5554"
    networks:
      - web
      - internal
```

3. **Deploy**
```bash
cd modern-server-infra/compose
docker compose pull crumb
docker compose up -d crumb
```

4. **Verify**
```bash
# Check health
curl https://crumb.yourdomain.com/health

# View logs
docker compose logs -f crumb
```

**Manual Docker Deployment (Alternative):**
```bash
# Pull image
docker pull ghcr.io/yancmo1/crumb-recipe-pwa:latest

# Run container
docker run -d \
  --name crumb \
  -p 5554:5554 \
  -e PORT=5554 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://user:pass@postgres:5432/crumb_db \
  ghcr.io/yancmo1/crumb-recipe-pwa:latest

# Check health
curl http://localhost:5554/health
```

### 4.4 Monitoring & Observability

**Health Endpoints:**
- `GET /health` - Basic health check
- Container health check runs every 30s

**Logging:**
- Structured logging to stdout
- Docker log aggregation
- Log levels: info, warn, error

**Metrics to Monitor:**
- Response times (especially /api/import)
- Error rates
- Import success/failure rates
- Database connection status
- Memory usage
- Active users (via session count)

**Alerts to Configure:**
- Health check failures
- High error rate (>5%)
- Database connection issues
- Memory usage >90%
- Disk usage >80%

---

## 5. Feature Status & Roadmap

### 5.1 Completed Features ✅

| Feature | Status | Version | Notes |
|---------|--------|---------|-------|
| Recipe Import | ✅ Done | 1.0 | 75-85% success rate |
| Plugin Detection | ✅ Done | 1.0 | WPRM, Tasty, Cooked |
| JSON-LD Extraction | ✅ Done | 1.0 | With quality scoring |
| Heuristic Fallback | ✅ Done | 1.0 | Multi-section support |
| Recipe Library | ✅ Done | 1.0 | Grid, search, favorites |
| Cook Mode | ✅ Done | 1.0 | Sessions with 72h TTL |
| Recipe Scaling | ✅ Done | 1.0 | Smart fractions |
| Step Timers | ✅ Done | 1.1 | With push notifications |
| Floating Timer Widget | ✅ Done | 1.1 | Multiple timers |
| Nutrition Display | ✅ Done | 1.0 | When available |
| Offline Mode | ✅ Done | 1.0 | Full functionality |
| PWA Support | ✅ Done | 1.0 | Safari (mobile/tablet) + Android |
| Server Storage | ✅ Done | 1.0 | PostgreSQL + sync |
| Multi-Device Sync | ✅ Done | 1.0 | Via server API |
| Export/Import | ✅ Done | 1.0 | JSON format |
| Categories & Tags | ✅ Done | 1.0 | User-defined |
| Favorites | ✅ Done | 1.0 | Sort to top |
| Dark Mode | ✅ Done | 1.0 | System, light, dark |
| Section Headers | ✅ Done | 1.0 | Ingredients & steps |

### 5.2 Known Limitations ⚠️

**Recipe Import:**
- Success rate 75-85% (some sites still fail)
- No automatic retry on failure
- Limited support for video-only recipes
- Paywalled recipes not accessible
- JavaScript-heavy sites may fail

**Sessions:**
- Cook sessions are device-local only (not synced)
- No conflict resolution for multi-device editing
- Session limit of 72 hours (hardcoded)

**Scaling:**
- Cannot scale non-numeric ingredients (e.g., "1 can tomatoes")
- No temperature conversion (F ↔ C)
- Gram conversions require manual override configuration

**Nutrition:**
- Only available from WPRM plugin sites
- No automatic calculation from ingredients
- Not scaled with recipe multiplier

**General:**
- No user accounts or authentication
- All recipes visible to all users of same deployment
- No recipe sharing or public URLs
- No collaborative features
- No recipe ratings or comments

### 5.3 Future Roadmap 🚀

#### Phase 2: Enhanced Import (Priority: HIGH)
**Goal:** Increase import success rate to 90%+

**Features:**
- [ ] Site-specific extractors for top 20 recipe sites
  - AllRecipes, Food Network, NYT Cooking, Bon Appétit
  - 80/20 rule: 20% of sites = 80% of imports
- [ ] Headless browser option (Puppeteer) for JS-heavy sites
- [ ] Recipe preview before saving
  - Allow user edits
  - Confirm before import
- [ ] Import error improvements
  - Better error messages
  - Suggest alternative URLs (print version)
  - Partial import option
- [ ] Automatic retry with different strategies
- [ ] Import queue for batch importing

**Estimated Effort:** 2-3 weeks

#### Phase 3: User Experience (Priority: MEDIUM)
**Goal:** Improve usability and polish

**Features:**
- [ ] Recipe preview before import
- [ ] Inline recipe editing
  - Edit title, ingredients, steps
  - Add personal notes
  - Upload custom images
- [ ] Ingredient substitutions
  - Suggest alternatives
  - User-defined substitution rules
- [ ] Shopping list generation
  - Combine ingredients from multiple recipes
  - Check off items while shopping
  - Share list via SMS/email
- [ ] Recipe collections/folders
  - Organize recipes into custom collections
  - "Meal Plan", "Thanksgiving", etc.
- [ ] Search improvements
  - Search ingredients
  - Search steps
  - Filter by cooking time
  - Filter by dietary restrictions

**Estimated Effort:** 3-4 weeks

#### Phase 4: Social & Sharing (Priority: LOW)
**Goal:** Enable recipe sharing and collaboration

**Features:**
- [ ] User accounts (optional)
  - Sign up / login
  - Private vs. public recipes
- [ ] Public recipe URLs
  - Share recipes with friends
  - View-only mode
- [ ] Recipe ratings
  - Star ratings
  - Personal notes visible to others
- [ ] Recipe comments
  - Tips from other users
  - Q&A section
- [ ] Community features
  - Follow other users
  - Discover popular recipes
  - Trending recipes

**Estimated Effort:** 4-6 weeks

#### Phase 5: Advanced Features (Priority: LOW)
**Goal:** Power user features

**Features:**
- [ ] Meal planning calendar
  - Drag recipes onto calendar
  - Auto-generate shopping list
  - Serve size planning
- [ ] Nutrition tracking
  - Daily/weekly nutrition summary
  - Custom nutrition goals
  - Calculate nutrition from ingredients (USDA database)
- [ ] Smart scaling with nutrition
  - Scale nutrition facts with multiplier
- [ ] Temperature conversion (F ↔ C)
- [ ] Automatic unit conversion
  - US ↔ Metric
  - Volume ↔ Weight (with density tables)
- [ ] Voice control
  - "Read next step"
  - "Start timer for 30 minutes"
  - Hands-free cooking mode
- [ ] Recipe versioning
  - Track changes to recipes
  - Revert to previous version
  - Compare versions
- [ ] Ingredient inventory
  - Track pantry items
  - Suggest recipes based on available ingredients
  - Low stock alerts

**Estimated Effort:** 6-8 weeks

#### Phase 6: Integrations (Priority: LOW)
**Goal:** Optional integrations and distribution

**Features:**
- [ ] Browser extension
  - One-click import from any page
  - Right-click → "Save to Crumb"
- [ ] Smart home integration
  - Google Assistant
  - Alexa
- [ ] IoT device integration
  - Smart oven pre-heating
  - Kitchen display tablets

**Estimated Effort:** 8-12 weeks per platform

### 5.4 Technical Debt & Improvements

**High Priority:**
- [ ] Add comprehensive test coverage (currently limited)
- [ ] Performance optimization for large recipe collections (>500 recipes)
- [ ] Database query optimization (add more indexes)
- [ ] Error boundary components for graceful failure
- [ ] Accessibility audit (WCAG 2.1 AA compliance)

**Medium Priority:**
- [ ] Migrate to TypeScript strict mode
- [ ] Reduce bundle size (currently ~800KB)
- [ ] Implement caching strategy for API responses
- [ ] Add request rate limiting
- [ ] Implement database migrations system

**Low Priority:**
- [ ] Refactor state management (consider TanStack Query)
- [ ] Migrate to React Router v7
- [ ] Update to Node.js 22 LTS
- [ ] Explore Biome as Vite alternative

---

## 6. Design & User Experience

### 6.1 Design System

**CrumbWorks Brand Palette:**
- **Sunset Orange (Primary Actions):** `#FD5E53`
- **Slate Blue (App Chrome/Vault Accents):** `#2C3E50`
- **Structural Dark Gray (Text/Containers):** `#4A4A4A`
- **Soft Yellow (Highlights):** `#F7D774`

Color usage rules:
- Orange for primary CTAs, header gradient bases
- Blue for navigation drawer/sidebar and chrome
- Gray for text and neutral structure
- Yellow sparingly for highlights/status

Gradients: subtle, smooth; used in header zones and vault accents.

**Typography:**
- **Font Family:** System font stack
- **Headings:** Semi-bold (600)
- **Body:** Regular (400)
- **Small Text:** Regular (400), slightly reduced opacity

**Spacing:**
- Base unit: 4px
- Common spacings: 8px, 12px, 16px, 24px, 32px
- Padding: 16px on mobile, 24px on desktop

**Components:**
- Rounded corners (8px default, 12px for cards)
- Subtle shadows for elevation
- Clear hover/active states
- Smooth transitions (200ms ease)

### 6.2 Mobile-First Approach

**Design Priorities:**
- Large touch targets (minimum 44x44px)
- One-handed operation where possible
- Thumb-friendly navigation (bottom nav bar)
- Minimize scrolling in cook mode
- Large, readable fonts (16px minimum)

**Responsive Breakpoints:**
- Mobile: <640px (1 column)
- Tablet: 640-1024px (2 columns)
- Desktop: >1024px (3+ columns)

**Safari/WebKit Optimizations:**
- Safe area padding for notched devices
- Proper viewport meta tags
- Apple touch icons
- Splash screens
- Status bar styling

### 6.3 Accessibility

**Current Implementation:**
- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support
- Sufficient color contrast (4.5:1 minimum)
- Focus visible indicators

**Areas for Improvement:**
- Screen reader testing
- ARIA live regions for dynamic content
- Skip navigation links
- Reduced motion support
- Full keyboard accessibility audit

---

## 6.4 UI/UX Redesign Compliance (CrumbWorks)

Implemented screens and changes to meet the PRD:

- Launch/Home Screen (`src/pages/Home.tsx`)
  - Full-bleed sunset orange header gradient (`.rv-header-gradient`)
  - Centered hero vault motif (lock icon fallback)
  - Primary CTA: Get Started (orange pill)

- Navigation Drawer/Sidebar (`src/components/NavDrawer.tsx`)
  - Slides from left, background slate blue
  - Menu: Recipes, Settings, About
  - Integrated into nav bars as left control

- Recipe List Screen (`src/pages/Library.tsx`)
  - Header gradient zone
  - Semi-flat recipe cards with light shadow
  - Primary import CTA updated to orange

- Recipe Detail Screen (`src/pages/RecipeDetail.tsx`)
  - Primary actions: Edit Recipe (orange), Share (Web Share / clipboard)
  - Existing cook mode preserved

- Recipe Editor Screen (`src/pages/EditRecipe.tsx`)
  - Inputs: Name, Ingredients (multi-line), Steps (multi-line), Tags
  - Sticky Save button (orange)
  - Sanitizes input (trims, splits lines; preserves group headers via **Header:**)

- Accessibility
  - Global focus-visible ring styles with orange accent
  - Keyboard navigation through drawer and forms

- Performance
  - Minimal route-based additions; large assets deferred

Routes updated in `src/App.tsx`:
- `/` and `/home` → Home
- `/library` → Recipe List
- `/recipe/:id` → Detail
- `/recipe/:id/edit` → Editor

Tailwind theme updated (`tailwind.config.js`) with brand tokens:
- `rvOrange`, `rvBlue`, `rvGray`, `rvYellow`

CSS additions (`src/index.css`):
- `.rv-header-gradient`, `.rv-radial-accent`, focus-visible rings

Definition of Done checks (initial pass):
- App launches without clipping; header gradient is full-bleed
- Navigation routes verified
- Palette and layout adhere to PRD
- Focus rings and contrast present; further audit recommended
- Offline persistence unchanged (IndexedDB via `src/db.ts`)

Next steps:
- Add About page content
- Audit icon exports (1024×1024 PNG, sRGB)
- Run full accessibility and performance audits

---

## 7. Security & Privacy

### 7.1 Security Measures

**Frontend:**
- Content Security Policy (CSP) headers
- XSS prevention via React's built-in escaping
- No eval() or dangerous innerHTML usage
- HTTPS only in production
- Secure cookie attributes

**Backend:**
- Input validation on all API endpoints
- SQL injection prevention (parameterized queries)
- Rate limiting on import endpoint
- CORS configuration
- Health check endpoint (no auth required)

**Infrastructure:**
- Non-root Docker container
- Minimal base image (Node.js Alpine)
- Regular dependency updates
- Secrets via environment variables
- Database connection pooling

### 7.2 Privacy Considerations

**Data Collection:**
- No analytics or tracking by default
- No user accounts (no personal data collected)
- Recipe URLs stored but not shared
- No external API calls except during import

**User Data:**
- All recipe data stored locally or on user's server
- No data sent to third parties
- Export/import gives users full data control
- Clear data option available

**Recommendations:**
- Add privacy policy page
- Implement GDPR compliance if deploying in EU
- Consider adding analytics (with opt-in)
- Add user consent for push notifications

---

## 8. Performance

### 8.1 Current Performance

**Lighthouse Scores (Target):**
- Performance: 90+
- Accessibility: 90+
- Best Practices: 95+
- SEO: 85+
- PWA: 100

**Key Metrics:**
- First Contentful Paint: <1.5s
- Time to Interactive: <3s
- Largest Contentful Paint: <2.5s
- Cumulative Layout Shift: <0.1

**Bundle Sizes:**
- Main bundle: ~800KB (gzipped)
- Vendor bundle: ~600KB (gzipped)
- Total: ~1.4MB (gzipped)

### 8.2 Optimization Strategies

**Code Splitting:**
- Route-based splitting
- Lazy load recipe detail page
- Lazy load settings page
- Defer non-critical JavaScript

**Asset Optimization:**
- Image lazy loading
- WebP format for images
- Responsive images (srcset)
- Icon sprite sheets

**Caching:**
- Service worker caches app shell
- Long-term caching for static assets
- API response caching (IndexedDB)
- Stale-while-revalidate strategy

**Database:**
- Indexes on frequently queried columns
- Connection pooling
- Query optimization
- Pagination for large recipe lists

---

## 9. Success Metrics

### 9.1 Key Performance Indicators (KPIs)

**User Engagement:**
- Active users (daily/weekly/monthly)
- Recipes imported per user
- Cook sessions created
- Session completion rate
- Return rate after first use

**Feature Usage:**
- Import success rate (target: 75-85%)
- Recipe scaling usage
- Step timer usage
- Offline usage rate
- Export/backup usage

**Technical:**
- App load time (target: <3s)
- API response time (target: <500ms)
- Error rate (target: <1%)
- Uptime (target: 99.5%+)

**Growth:**
- New users per month
- Recipe count growth
- Feature adoption rate
- PWA install rate

### 9.2 Success Criteria

**Must Have (P0):**
- ✅ Import success rate >75%
- ✅ App works offline
- ✅ PWA installable on Safari/Android
- ✅ Core features functional without bugs
- ✅ Deployment automated via CI/CD

**Should Have (P1):**
- ✅ Multi-device sync working
- ✅ Recipe scaling accurate
- ✅ Cook sessions persistent
- ✅ Search and filtering working
- ✅ Export/import functional

**Nice to Have (P2):**
- ✅ Step timers with push notifications
- ✅ Nutrition display
- ⚠️ Dark mode polished
- ⚠️ Accessibility audit passed
- ❌ User onboarding flow

---

## 10. Support & Maintenance

### 10.1 Maintenance Requirements

**Regular Tasks:**
- Dependency updates (monthly)
- Security patches (as needed)
- Docker image updates (quarterly)
- Database backups (daily)
- Log rotation (weekly)

**Monitoring:**
- Health check status
- Error logs
- Import success/failure rates
- Performance metrics
- Storage usage

### 10.2 Troubleshooting

**Common Issues:**

**Import Failures:**
- Check site structure hasn't changed
- Review extraction logs
- Try print version URL
- Consider adding site-specific extractor

**Offline Issues:**
- Verify service worker registered
- Check IndexedDB storage quota
- Clear cache and retry
- Check browser compatibility

**Performance Issues:**
- Check recipe count (>500 may be slow)
- Review database query performance
- Monitor memory usage
- Consider pagination

**Deployment Issues:**
- Verify environment variables
- Check database connection
- Review Docker logs
- Confirm health check passing

### 10.3 Documentation

**Internal:**
- `README.md` - Quick start guide
- `ARCHITECTURE.md` - System architecture
- `IMPROVEMENTS.md` - Scraping improvements
- `SERVER-STORAGE.md` - Storage implementation
- `NUTRITION.md` - Nutrition feature
- `UI-IMPROVEMENTS.md` - UI changes
- `QUICK_START.md` - Developer quick start
- `PRD.md` - This document

**External (Future):**
- User guide / help docs
- API documentation
- Contribution guidelines
- Changelog

---

## 11. Risks & Mitigations

### 11.1 Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Recipe sites change structure | High | High | Plugin-based extraction, regular testing |
| Browser compatibility issues | Medium | Low | Progressive enhancement, polyfills |
| Database connection loss | High | Low | Connection pooling, retry logic |
| Storage quota exceeded | Medium | Medium | Cleanup old sessions, pagination |
| Service worker cache issues | Medium | Low | Cache versioning, clear cache option |
| Import performance degradation | Medium | Medium | Caching, rate limiting, timeouts |

### 11.2 Business Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Legal issues (recipe copyright) | High | Low | Store only metadata + URL, link to source |
| Recipe sites block scraping | High | Medium | Respectful scraping, proper user agent |
| Hosting costs increase | Low | Medium | Efficient caching, resource limits |
| User data loss | High | Low | Export/import, regular backups |
| Competition from other apps | Medium | Medium | Focus on unique features, open source |

---

## 12. Open Questions & Decisions

### 12.1 Pending Decisions

**User Authentication:**
- ❓ Should we add optional user accounts?
  - **Pros:** Private recipes, better sync, analytics
  - **Cons:** Complexity, privacy concerns, maintenance
  - **Decision:** Defer to Phase 4, evaluate user demand

**Social Features:**
- ❓ Should we support recipe sharing?
  - **Pros:** Network effects, user engagement
  - **Cons:** Moderation, legal considerations
  - **Decision:** Defer to Phase 4, focus on core features

**Monetization:**
- ❓ Should this be a paid app or free/open source?
  - **Pros (Paid):** Sustainable, focused development
  - **Pros (Free):** Wider reach, community contributions
  - **Decision:** Currently free/open source, revisit in future

**Mobile Apps:**
- ❓ Should we build native apps or stick with PWA?
  - **Pros (Native):** Better app store visibility, full device access
  - **Pros (PWA):** Single codebase, easier updates
  - **Decision:** PWA for now, native apps in Phase 6 if needed

### 12.2 Technical Questions

**Scaling:**
- ❓ How to handle 10,000+ recipes per user?
  - Pagination, virtualization, search indexing
  - **Action:** Monitor performance, implement as needed

**Multi-tenancy:**
- ❓ Should we support separate recipe collections per user?
  - Requires authentication system
  - **Action:** Defer to Phase 4

**Recipe Versioning:**
- ❓ Should we track recipe edit history?
  - Useful for reverting changes
  - **Action:** Phase 5 feature

---

## 13. Appendix

### 13.1 Glossary

- **PWA (Progressive Web App):** Web application that works like a native app, installable and works offline
- **Service Worker:** Background script that enables offline functionality and push notifications
- **IndexedDB:** Browser-based database for storing large amounts of structured data
- **JSON-LD:** JSON format for embedding structured data (Schema.org) in web pages
- **WPRM:** WordPress Recipe Maker, a popular recipe plugin
- **VAPID:** Voluntary Application Server Identification, protocol for push notifications
- **Cook Session:** Temporary state tracking ingredient/step completion for a recipe
- **Recipe Multiplier:** Factor for scaling recipe quantities (0.5×, 1×, 2×, etc.)

### 13.2 References

**External Documentation:**
- [Schema.org Recipe Schema](https://schema.org/Recipe)
- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web Push Protocol](https://web.dev/push-notifications/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)

**Internal Documentation:**
- See section 10.3 for complete list

### 13.3 Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2025-12-24 | Initial PRD created | Copilot |

---

## 14. Contacts & Resources

### 14.1 Repository

- **GitHub:** https://github.com/yancmo1/crumb-recipe-pwa
- **Image Registry:** ghcr.io/yancmo1/crumb-recipe-pwa
- **Issues:** https://github.com/yancmo1/crumb-recipe-pwa/issues

### 14.2 Deployment

- **Production:** https://crumb.yourdomain.com (configure in infrastructure repo)
- **Health Check:** https://crumb.yourdomain.com/health
- **Infrastructure Repo:** modern-server-infra

### 14.3 Development

- **Local Frontend:** http://localhost:5173
- **Local API:** http://localhost:3000 or :5554
- **Docker Dev:** http://localhost:5173 (frontend), :5555 (API)

---

**END OF DOCUMENT**

*This is a living document. Please update as features are added, decisions are made, and the product evolves.*
