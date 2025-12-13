# Deploy `crumb.yancmo.xyz` on `ubuntumac` (Traefik + Cloudflare Tunnel)

This repo builds a  single container that serves:
- the built frontend from `dist/`
- the Express API under `/api/*`
- a health endpoint at `/health`

The production pattern on your server is:

`Cloudflare Tunnel → https://localhost:443 (noTLSVerify) → Traefik → crumb container (port 5554)`

## 1) Prereqs

- Traefik is already running in the `infra-new` stack.
- Cloudflared tunnel is dashboard-managed (Zero Trust UI), not local `config.yml`.
- Image is published to GHCR by this repo’s GitHub Actions workflow.

### GHCR image

The default image name is:
- `ghcr.io/yancmo1/crumb-recipe-pwa:latest`

(That comes from `${{ github.repository }}` in `.github/workflows/build-push.yml`.)

## 2) Add the service to the infra compose

On the server, edit:
- `/opt/infra-new/compose/docker-compose.yml`

Add the service definition from:
- `deploy/infra-new/crumb.service.yml`

Notes:
- `crumb` must join **edge** (public) and **backend** (db access) networks.
- `crumb-postgres` should join **backend** only.

## 3) Add environment variables

On the server, edit:
- `/opt/infra-new/compose/.env`

Add:
- `CRUMB_HOST=crumb.yancmo.xyz`
- `CRUMB_POSTGRES_PASSWORD=<generate_a_strong_password>`

## 4) Deploy

From the server:
- Validate compose: `docker compose -p infra-new config`
- Pull & start: `docker compose -p infra-new up -d crumb crumb-postgres`

Then verify logs and health:
- `docker logs infra-new-crumb-1 --tail 100 -f`
- `docker logs infra-new-crumb-postgres-1 --tail 100 -f`

## 5) Wire Cloudflare Tunnel to Traefik

In Cloudflare Zero Trust Dashboard:

1. Go to **Networks → Tunnels → (your tunnel) → Public Hostnames**
2. Add hostname:
   - Subdomain: `crumb`
   - Domain: `yancmo.xyz`
   - Service: `https://localhost:443`
   - TLS: enable **No TLS Verify**

This matches the recommended Pattern A in `SERVER_MASTER_GUIDE.md`.

## 6) Update cloudflared (container-based)

Cloudflared runs as `infra-new-cloudflared-1`. To upgrade, pull and recreate:

- `docker compose -p infra-new pull cloudflared`
- `docker compose -p infra-new up -d cloudflared`

Then verify tunnel is connected:
- `docker logs infra-new-cloudflared-1 --tail 50`

(Health may still show “unhealthy”; that is expected per the Master Guide.)

## 7) Add to GHCR auto-deploy

Your server has a systemd service that periodically checks GHCR and redeploys tracked services:
- `/opt/apps/scripts/ghcr-auto-deploy.sh`

Add an entry that maps:
- service name: `crumb`
- image: `ghcr.io/yancmo1/crumb-recipe-pwa:latest`

After editing, restart and watch logs:
- `sudo systemctl restart ghcr-auto-deploy.service`
- `tail -f /opt/apps/logs/ghcr-auto-deploy.log`

## 8) Quick verification checklist

- `https://crumb.yancmo.xyz/health` returns `{"status":"ok"...}`
- Traefik dashboard shows a router for `crumb` and a healthy service
- `docker ps | grep infra-new-crumb`
- `docker exec infra-new-crumb-1 wget -qO- http://localhost:5554/health`

## Troubleshooting

### 1) App won’t start: DATABASE_URL errors

The app initializes its schema on startup. If `DATABASE_URL` is missing or wrong, it will exit.
Confirm:
- `.env` contains `CRUMB_POSTGRES_PASSWORD`
- `crumb` has `DATABASE_URL=postgresql://crumb:...@crumb-postgres:5432/crumb`
- `crumb-postgres` is healthy

### 2) 404 from tunnel

If Cloudflare tunnel points to `https://localhost:443` but Traefik isn’t routing:
- ensure crumb has Traefik labels and is attached to **edge** network
- ensure `CRUMB_HOST` matches `crumb.yancmo.xyz`

