#!/bin/bash

# Crumb PWA Setup Script
# One-shot setup for local development on Mac/iPhone

set -e

echo "🍳 Setting up Crumb - Recipe PWA"
echo "================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker Desktop first:"
    echo "   https://docs.docker.com/desktop/mac/install/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Desktop first:"
    echo "   https://docs.docker.com/desktop/mac/install/"
    exit 1
fi

echo "✅ Docker found"

# Create necessary directories
mkdir -p logs
mkdir -p ssl

echo "✅ Created directories"

# Create placeholder icons (you can replace these with real icons later)
echo "📱 Creating placeholder PWA icons..."

# Create public directory first
mkdir -p public

# Create simple SVG icon
cat > public/vite.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="#7C8FB2"/>
  <text x="50" y="60" text-anchor="middle" fill="white" font-size="40" font-family="serif">🍳</text>
</svg>
EOF

# Create placeholder icons (you would normally generate these properly)
echo "🍳 Crumb PWA Icon" > public/apple-touch-icon.png
echo "🍳 Crumb PWA Icon 152" > public/apple-touch-icon-152x152.png
echo "🍳 Crumb PWA Icon 167" > public/apple-touch-icon-167x167.png
echo "🍳 Crumb PWA Icon 180" > public/apple-touch-icon-180x180.png
echo "🍳 CrumbWorks PWA Icon 192" > public/crumbworks-192x192.png
echo "🍳 CrumbWorks PWA Icon 512" > public/crumbworks-512x512.png

# Create placeholder splash screens
echo "🍳 Crumb Splash 750x1334" > public/splash-750x1334.png
echo "🍳 Crumb Splash 1125x2436" > public/splash-1125x2436.png
echo "🍳 Crumb Splash 1242x2208" > public/splash-1242x2208.png

echo "✅ Created placeholder icons (replace with real icons later)"

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
docker-compose down -v 2>/dev/null || true

echo "🏗️  Building and starting services..."

# Build and start services
docker-compose up --build -d

echo "⏳ Waiting for services to start..."
sleep 10

# Health check
echo "🔍 Checking service health..."
if curl -f http://localhost:3000/health &>/dev/null; then
    echo "✅ Server is healthy"
else
    echo "⚠️  Server health check failed, but it might still be starting..."
fi

echo ""
echo "🎉 Crumb PWA is now running!"
echo ""
echo "📱 Development URLs:"
echo "   Main app:     http://localhost:3000"
echo "   Via Nginx:    http://localhost (if nginx service is running)"
echo "   Health check: http://localhost:3000/health"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. 📱 Test on iPhone Safari:"
echo "   - Get your local IP: ifconfig | grep 'inet ' | grep -v 127.0.0.1"
echo "   - Access http://YOUR_LOCAL_IP:3000 on iPhone"
echo "   - Add to Home Screen for PWA experience"
echo ""
echo "2. 🧪 Test recipe import with these URLs:"
echo "   - https://www.theclevercarrot.com/2020/05/homemade-fluffy-sourdough-pancakes/"
echo "   - https://www.pantrymama.com/sourdough-cinnamon-roll-focaccia-bread/"
echo "   - https://www.farmhouseonboone.com/homemade-sourdough-oatmeal-cream-pies/"
echo ""
echo "3. 🔧 For development mode (hot reload):"
echo "   docker-compose down"
echo "   npm install"
echo "   npm run dev (frontend on :5173)"
echo "   npm run server (API on :3001)"
echo ""
echo "4. 📊 View logs:"
echo "   docker-compose logs -f crumb"
echo ""
echo "5. 🛑 Stop services:"
echo "   docker-compose down"
echo ""

# Display local IP for iPhone testing
LOCAL_IP=$(ifconfig | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
if [ ! -z "$LOCAL_IP" ]; then
    echo "📱 iPhone Safari URL: http://$LOCAL_IP:3000"
    echo ""
fi

echo "Happy cooking! 🍳"