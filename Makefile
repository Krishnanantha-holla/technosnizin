# SONIQ — root Makefile
# Usage: make <target>

.PHONY: help up down build logs test lint fmt clean

help:
	@echo ""
	@echo "  SONIQ — available targets"
	@echo ""
	@echo "  make up        Start all services (docker compose up --build -d)"
	@echo "  make down      Stop all services"
	@echo "  make build     Build all Docker images"
	@echo "  make logs      Tail logs from all services"
	@echo "  make test      Run all test suites"
	@echo "  make lint      Run linters (ruff + svelte-check)"
	@echo "  make fmt       Auto-format (ruff format + prettier)"
	@echo "  make clean     Remove containers, volumes, built artifacts"
	@echo ""

# ── Docker ────────────────────────────────────────────────────────────────────
up:
	docker compose up --build -d
	@echo ""
	@echo "  ✓ SONIQ running at http://localhost"
	@echo "  ✓ API at http://localhost/api"
	@echo ""

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

# ── Tests ─────────────────────────────────────────────────────────────────────
test: test-backend test-svelte test-wasm

test-backend:
	@echo "── Backend tests ──"
	cd soniq-backend && .venv/bin/python -m pytest tests/ -q

test-svelte:
	@echo "── Svelte check ──"
	cd soniq-svelte && npm run check

test-wasm:
	@echo "── Rust tests ──"
	cd soniq-svelte/src/lib/wasm-engine && cargo test

# ── Lint ──────────────────────────────────────────────────────────────────────
lint:
	@echo "── Ruff ──"
	cd soniq-backend && .venv/bin/ruff check .
	@echo "── Svelte check ──"
	cd soniq-svelte && npm run check

fmt:
	@echo "── Ruff format ──"
	cd soniq-backend && .venv/bin/ruff format .
	@echo "── Prettier ──"
	cd soniq-svelte && npx prettier --write "src/**/*.{ts,svelte,css}"

# ── Dev servers (run manually — these block) ─────────────────────────────────
dev-svelte:
	cd soniq-svelte && npm run dev

dev-backend:
	cd soniq-backend && .venv/bin/uvicorn app.main:app --reload --port 8000

# ── Clean ─────────────────────────────────────────────────────────────────────
clean:
	docker compose down -v --remove-orphans
	rm -rf soniq-svelte/.svelte-kit soniq-svelte/build
	rm -rf soniq-backend/.pytest_cache soniq-backend/htmlcov
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
