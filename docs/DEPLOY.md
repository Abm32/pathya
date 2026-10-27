# Deploy

One container (Node 22 on the official `pgkb/pharmcat` image). Needs ~2 GB RAM (PharmCAT JVM) and outbound HTTPS to api.meta.ai.

## Option A: EC2 (what the demo runs on)

Account: Anukriti AI AWS (`AWS_PROFILE=anukriti`), region ap-south-1. Instance `pathya` (t3.medium, 30 GB gp3, Ubuntu 24.04, Docker via user-data), security group `pathya` (22/80/443), Elastic IP, key `~/.ssh/pathya.pem`. Public URL uses sslip.io so no DNS record is needed; Caddy gets a Let's Encrypt cert for it.

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
