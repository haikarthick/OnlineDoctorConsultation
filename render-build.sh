#!/usr/bin/env bash
# ─────────────────────────────────────────────────
# Render.com Build Script
# Builds both frontend (React/Vite) and backend (Express/TypeScript)
# ─────────────────────────────────────────────────
set -e

echo "══════════════════════════════════════════"
echo "  VetCare Platform — Build"
echo "══════════════════════════════════════════"

# 1. Build Frontend
echo ""
echo "━━━ Building Frontend (React + Vite) ━━━"
cd frontend
npm install --include=dev
npm run build
echo "✓ Frontend built → frontend/dist/"

# 2. Build Backend
echo ""
echo "━━━ Building Backend (Express + TypeScript) ━━━"
cd ../backend
npm install --include=dev
npm run build
echo "✓ Backend built → backend/dist/"

echo ""
echo "══════════════════════════════════════════"
echo "  Build complete!"
echo "══════════════════════════════════════════"
