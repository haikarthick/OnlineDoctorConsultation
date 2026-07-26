#!/usr/bin/env bash
# ─────────────────────────────────────────────────
# Render.com Build Script
# Builds both frontend (React/Vite) and backend (Express/TypeScript)
# ─────────────────────────────────────────────────
set -e

echo "══════════════════════════════════════════"
echo "  VetCare Platform — Build"
echo "══════════════════════════════════════════"

# A deployed app must ALWAYS be compiled as a PRODUCTION build, regardless of the
# service's runtime NODE_ENV. Render's `vetcare-dev` service sets NODE_ENV=development
# (correct for the BACKEND *runtime*), but that same env leaks into the build step and
# makes `vite build` emit React's dev build AND ~147KB of extra dev-only, build-time
# library branches in the entry chunk — pushing it past the 600KB bundle-budget and
# FAILING the deploy (demo, which runs NODE_ENV=production, always passed — that mismatch
# was the entire bug). A Vite `define` only rewrites bundled-code text, NOT the build-time
# `process.env.NODE_ENV` checks libraries evaluate in Node, so the env var is the ONLY
# reliable lever. We force NODE_ENV=production for the BUILD commands only (inline prefix,
# scoped to that one subprocess) — `npm install --include=dev` still pulls devDeps, and the
# runtime NODE_ENV=development is untouched (render-start.sh is a separate process).
# See lessons: [[feedback-deploy-safety]].

# 1. Build Frontend
echo ""
echo "━━━ Building Frontend (React + Vite) ━━━"
cd frontend
npm install --include=dev
NODE_ENV=production npm run build
echo "✓ Frontend built → frontend/dist/"

# 2. Build Backend
echo ""
echo "━━━ Building Backend (Express + TypeScript) ━━━"
cd ../backend
npm install --include=dev
NODE_ENV=production npm run build
echo "✓ Backend built → backend/dist/"

echo ""
echo "══════════════════════════════════════════"
echo "  Build complete!"
echo "══════════════════════════════════════════"
