# Deploy

One container (Node 22 on the official `pgkb/pharmcat` image). Needs ~2 GB RAM (PharmCAT JVM) and outbound HTTPS to api.meta.ai.

## Option A: EC2 (what the demo runs on)

Account: Anukriti AI AWS (`AWS_PROFILE=anukriti`), region ap-south-1. Instance `pathya` (t3.medium, 30 GB gp3, Ubuntu 24.04, Docker via user-data), security group `pathya` (22/80/443), Elastic IP, key `~/.ssh/pathya.pem`. Public URL is https://pathya.anukritiai.com (A record to the Elastic IP); the original https://16.4.131.103.sslip.io still works. Caddy gets Let's Encrypt certs for both.

```bash
# from the laptop: repo is private, so ship the working tree instead of git clone
rsync -az --delete -e "ssh -i ~/.ssh/pathya.pem" --exclude node_modules --exclude .next --exclude data --exclude .git --exclude '.env*' ./ ubuntu@<ip>:~/pathya/
scp -i ~/.ssh/pathya.pem .env.ec2 ubuntu@<ip>:~/pathya/.env   # .env.ec2 = local .env + ACCESS_CODE, PHARMCAT_RUNNER=local, DATA_DIR=/data (gitignored)

# on the VM
cd ~/pathya && docker compose up -d --build
docker run -d --name caddy --restart unless-stopped --network host -v caddy:/data caddy:2 \
  caddy reverse-proxy --from <ip>.sslip.io --to localhost:3000
```

Redeploy = rerun the rsync, then `docker compose up -d --build` (2-3 min, PharmCAT layer is cached). HTTPS is required for the mic recorder (getUserMedia needs a secure context).

### Environment on the server (`~/pathya/.env`, never in git)

| Variable | Purpose |
|---|---|
| `MODEL_API_KEY` | Meta Model API (Muse Spark 1.3, Muse Voice) |
| `BASETEN_API_KEY` | Muse Spark Open on Baseten (second path and fallback) |
| `ACCESS_CODE` | Curator credential, not an entry gate: the site is open to everyone. It allows curator review and writes into a verified cohort. Empty makes everyone a curator. |
| `PUBLIC_CASES` | Comma-separated record ids readable without the code; `/sample` opens the first. |
| `PUBLIC_COHORT` | Cohorts whose statistics and records are public (default `demo`, synthetic only). Must include `visitors`, where runs by people without the curator code are filed. |
| `PHARMCAT_RUNNER=local`, `DATA_DIR=/data` | Set by `docker-compose.yml`. |

### Custom domain: pathya.anukritiai.com (live since 2026-10-30)

1. DNS: an `A` record for `pathya` pointing to `16.4.131.103`.
2. Once `dig +short pathya.anukritiai.com` returns that IP, run Caddy with both hosts so the sslip link keeps working:

```bash
docker rm -f caddy
printf 'pathya.anukritiai.com, 16.4.131.103.sslip.io {\n  reverse_proxy localhost:3000\n}\n' > ~/Caddyfile
docker run -d --name caddy --restart unless-stopped --network host -v caddy:/data -v ~/Caddyfile:/etc/caddy/Caddyfile caddy:2
```

3. Set `metadataBase` in `src/app/layout.tsx` to the new domain (share previews use it), redeploy, and update the links in README and SUBMISSION.

### Demo cohort

Seed it through the real pipeline with one phone photo per synthetic person from the benchmark sets (24 records):

```bash
ACCESS_CODE=<code> npx tsx scripts/seed-cohort.mts https://<host>        # cohort "demo"
```

### Public sample report

The home page links "open a finished report" to `/sample`. To pin a new sample after changing the sample regimen:

```bash
# log in with the code, run the photo sample, note the id
curl -s -c jar -H 'content-type: application/json' -d '{"code":"<ACCESS_CODE>"}' https://<host>/api/login
curl -s -b jar -F sample=photo -F cohort=samples https://<host>/api/analyze
# on the VM: set PUBLIC_CASES=<id> in ~/pathya/.env, then
docker compose up -d
```

Current pinned case: `39c2d714da1b` (2026-10-30, research-record pipeline).

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
ACCESS_CODE=<code> npx tsx scripts/eval.mts https://<host>      # 4 end-to-end cases, logs in with the code
curl -s -o /dev/null -w "%{http_code}\n" https://<host>/sample   # 307 to the pinned report, no code needed
curl -s -X POST https://<host>/api/analyze                       # 401 with a sign-in message: runs stay gated
```
