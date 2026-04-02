#!/bin/bash
# Vercel Deployment Script for SarkarHamariHai
# This script will deploy your project to Vercel production

echo ""
echo "========================================="
echo " SarkarHamariHai Vercel Deployment"
echo "========================================="
echo ""
echo "Project: sarkar-hamari-hai"
echo "Target: sarkarhamarihai.vercel.app"
echo ""

# Change to project directory
cd "D:\build-govguide-ai-app (2)\build-govguide-ai-app (1)" || cd "/mnt/d/build-govguide-ai-app (2)/build-govguide-ai-app (1)" || exit 1

# Step 1: Check Node and npm
echo "[Step 1] Checking Node.js and npm..."
node --version
npm --version
echo ""

# Step 2: Install dependencies
echo "[Step 2] Installing dependencies..."
npm install --prefer-offline --no-audit
if [ $? -ne 0 ]; then
    echo "Error: npm install failed"
    exit 1
fi
echo "✓ Dependencies installed"
echo ""

# Step 3: Build project
echo "[Step 3] Building with Vite..."
npm run build
if [ $? -ne 0 ]; then
    echo "Error: npm run build failed"
    exit 1
fi
echo "✓ Build completed"
echo ""

# Step 4: Deploy to Vercel
echo "[Step 4] Deploying to Vercel production..."
npx vercel deploy --prod --yes
if [ $? -ne 0 ]; then
    echo ""
    echo "! Deployment may have failed or requires authentication"
    echo "! Try running: npx vercel login"
    echo "! Then try again: npx vercel deploy --prod --yes"
    exit 1
fi

echo ""
echo "========================================="
echo " ✓ DEPLOYMENT SUCCESSFUL!"
echo "========================================="
echo ""
echo "🌐 Live URL: https://sarkarhamarihai.vercel.app"
echo "📦 Project: sarkar-hamari-hai"
echo "API: https://sarkarhamarihai.vercel.app/api"
echo ""
echo "Your application is now live on Vercel!"
echo ""
