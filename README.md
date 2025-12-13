# Crumb - Offline Recipe PWA

A mobile-first Progressive Web App for managing and cooking from recipes offline. Built with React, TypeScript, and designed specifically for home cooks.

## Features

- 🍳 **Import recipes by URL** - Automatically extracts ingredients, steps, and metadata from recipe websites
- 📱 **Mobile-first PWA** - Optimized for iPhone Safari with proper PWA support
- 🔄 **Recipe scaling** - Scale ingredients with clean fraction display (½×, 1.5×, 2×, etc.)
- ✅ **Cook mode** - Check off ingredients and steps with temporary session persistence (72h TTL)
- 📴 **Offline-first** - Works completely offline once recipes are imported
- 🎨 **Kitchen-themed design** - Warm, cozy color palette with excellent readability
- 🖨️ **Print-friendly** - Clean printouts without UI clutter
- 🐘 **PostgreSQL Backend** - Server-side recipe storage with PostgreSQL database
- 🚀 **CI/CD Pipeline** - Automated Docker builds via GitHub Actions to GHCR

## Production Deployment

This app is designed to be deployed via the central `modern-server-infra` repository which handles:
- Traefik reverse proxy with automatic HTTPS
- PostgreSQL database (`crumb_db`)
- Redis caching layer
- Monitoring and observability

**Prerequisites:**
- Docker image built and pushed to GHCR (automatic via GitHub Actions)
- Infrastructure repo cloned and configured
- GHCR authentication configured

**Deployment Steps:**

1. **Pull the latest image**
   ```bash
   docker pull ghcr.io/yancmo1/crumb-recipe-pwa:latest
   ```

2. **Configure in infrastructure**
   - Add service definition to `modern-server-infra/compose/docker-compose.yml`
   - Set environment variables (database connection, port 5554)
   - Ensure database `crumb_db` exists

3. **Deploy**
   ```bash
   cd modern-server-infra/compose
   docker compose up -d crumb
   ```

4. **Access the app**
   - Via Traefik: `https://crumb.yourdomain.com`

### Local Development Setup

If you want to run without Docker for development:

```bash
# Install dependencies
npm install

# Start the development server (frontend only)
npm run dev

# In another terminal, start the import server
npm run server
```

- Frontend: `http://localhost:5173`
- API server: `http://localhost:3001`

## Architecture

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** with custom kitchen color palette
- **Zustand** for state management
- **Dexie** for IndexedDB storage
- **Workbox** for PWA and offline capabilities

### Backend
- **Express.js** server for recipe import API
- **Cheerio** + **@mozilla/readability** for HTML parsing
- **JSON-LD Schema.org** extraction with heuristic fallbacks
- Ingredient parsing with fraction support

### Storage
- **IndexedDB** for recipes and ephemeral cook sessions
- **localStorage** for app settings
- No cloud dependencies - everything works offline

## Usage

### Importing Recipes

1. Click the "+" button on the home screen
2. Paste a recipe URL (supports most cooking sites)
3. The app will extract ingredients, steps, images, and metadata
4. Recipe is stored locally for offline access

### Cooking Mode

1. Open a recipe
2. Click "Start Cooking" to begin a session
3. Check off ingredients and steps as you cook
4. Session persists for 72 hours with option to extend
5. Use the scale controls to adjust serving sizes

### Tested Recipe Sources

The import engine has been validated with:
- [The Clever Carrot - Sourdough Pancakes](https://www.theclevercarrot.com/2020/05/homemade-fluffy-sourdough-pancakes/)
- [Pantry Mama - Cinnamon Roll Focaccia](https://www.pantrymama.com/sourdough-cinnamon-roll-focaccia-bread/)
- [Farmhouse on Boone - Oatmeal Cream Pies](https://www.farmhouseonboone.com/homemade-sourdough-oatmeal-cream-pies/)

## Deployment

### Docker Production Deploy

```bash
# Build and run
docker-compose -f docker-compose.yml up -d

# With custom SSL (update nginx.conf paths)
docker-compose -f docker-compose.yml up -d nginx
```

### Ubuntu Server Deploy

1. **Install Docker**:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

2. **Setup SSL with Let's Encrypt**:
```bash
# Install certbot
sudo apt install certbot

# Get certificates (replace with your domain)
sudo certbot certonly --standalone -d your-domain.com

# Update nginx.conf with cert paths
# ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
```

3. **Deploy**:
```bash
git clone <repository-url> /opt/crumb
cd /opt/crumb
docker-compose up -d
```

4. **Auto-renewal** (crontab):
```bash
0 12 * * * /usr/bin/certbot renew --quiet && docker-compose restart nginx
```

### Environment Variables

```bash
# Port
# - Local dev default (when running `npm run server`): 3000
# - Container / infra-new recommended: 5554
PORT=5554

# Node environment
NODE_ENV=production
```

## Development

### Project Structure
```
crumb/
├── src/                    # React frontend
│   ├── components/         # Reusable components
│   ├── pages/             # Route components
│   ├── state/             # Zustand stores
│   ├── utils/             # Utility functions
│   └── types.ts           # TypeScript definitions
├── server/                # Express.js backend
│   ├── index.js           # Main server
│   └── utils.js           # Parsing utilities
├── public/                # Static assets
├── Dockerfile             # Multi-stage Docker build
├── docker-compose.yml     # Container orchestration
└── nginx.conf            # Production web server config
```

### Key Components

- **Library** (`/`) - Recipe collection with search
- **Import** (`/import`) - URL-based recipe import
- **Recipe Detail** (`/recipe/:id`) - Cook mode with scaling
- **Settings** (`/settings`) - Data management and preferences

### State Management

- **Recipe Store** - Recipe CRUD operations
- **Cook Session Store** - Ephemeral cooking state with TTL
- **Settings Store** - Persisted user preferences

### Recipe Import Pipeline

1. **Fetch HTML** with proper user agent
2. **JSON-LD extraction** - Primary method for schema.org recipes
3. **Microdata fallback** - Secondary structured data extraction
4. **Print version** - Attempt cleaner version if available
5. **Heuristic parsing** - Readability + pattern matching as last resort
6. **Ingredient tokenization** - Parse amounts, units, and notes

## Testing

```bash
# Unit tests
npm test

# E2E tests (Playwright)
npm run test:e2e

# Test recipe import
curl -X POST http://localhost:3000/api/import \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.theclevercarrot.com/2020/05/homemade-fluffy-sourdough-pancakes/"}'
```

## PWA Features

### iOS Safari Support
- Proper `apple-mobile-web-app-*` meta tags
- Touch icons and splash screens
- Standalone display mode
- Safe area padding for notched devices

### Offline Capabilities
- App shell cached via service worker
- Recipe images cached with TTL
- Full functionality offline after initial load
- Background sync for future API calls

### Performance
- Code splitting by route
- Image lazy loading
- Gzip/Brotli compression
- Long-term asset caching

## Browser Support

- ✅ iOS Safari 14+ (primary target)
- ✅ Chrome/Edge 88+
- ✅ Firefox 85+
- ⚠️ Safari Desktop (limited PWA features)

## License

MIT License - feel free to use for personal cooking adventures!

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Happy cooking! 🍳**