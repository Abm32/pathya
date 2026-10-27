# Deploy

One container (Node 22 on the official `pgkb/pharmcat` image). Needs ~2 GB RAM (PharmCAT JVM) and outbound HTTPS to api.meta.ai.

## Option A: EC2 / any VM with Docker (recommended for the demo)

```bash
# on the VM
git clone https://github.com/Abm32/pathya && cd pathya
cp .env.example .env   # set MODEL_API_KEY, BASETEN_API_KEY and ACCESS_CODE
docker compose up -d --build
# https via Caddy (auto TLS):
docker run -d --name caddy --network host -v caddy:/data caddy:2 caddy reverse-proxy --from pathya.<your-domain> --to localhost:3000
```

Open ports 80/443 in the security group. Point an A record at the VM. First build takes ~5 min (Node install + pnpm).

## Option B: Fly.io

```bash
fly launch --no-deploy --name pathya --vm-memory 2048
fly secrets set MODEL_API_KEY=... BASETEN_API_KEY=... ACCESS_CODE=...
fly volumes create pathya_data --size 3
# add to fly.toml: [mounts] source="pathya_data" destination="/data"  and  [env] PHARMCAT_RUNNER="local" DATA_DIR="/data"
fly deploy
```

## Not Vercel

PharmCAT needs a JVM and the preprocessor's Python/bcftools stack; Vercel Functions cannot run it. Splitting PharmCAT into a separate service (Modal credits) is possible but adds a network hop and PHI surface for no demo benefit.

## Checks after deploy

```bash
curl -s https://<host>/api/login -X POST -H 'content-type: application/json' -d '{"code":"<ACCESS_CODE>"}' -c c.txt
curl -s -b c.txt -X POST -F sample=lab -F 'meds=capecitabine' https://<host>/api/analyze   # {"id":...}
pnpm tsx scripts/eval.mts https://<host>   # needs auth disabled or cookie support; run locally against the container instead
```
