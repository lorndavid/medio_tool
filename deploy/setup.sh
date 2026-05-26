#!/usr/bin/env bash
# ============================================================
# MediaFlow Bot — first-time setup on Ubuntu 22.04 (Oracle Cloud)
# Run ONCE on a fresh VM. Re-running is safe (idempotent).
# Usage:
#   bash deploy/setup.sh
# ============================================================
set -euo pipefail

echo ">>> Updating apt..."
sudo apt update -y
sudo apt upgrade -y

echo ">>> Installing base packages..."
sudo apt install -y curl ca-certificates git build-essential nginx ufw python3-pip cron

echo ">>> Installing Node.js 20..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi
node -v
npm -v

echo ">>> Installing PM2..."
sudo npm install -g pm2

echo ">>> Installing yt-dlp (for YouTube audio)..."
pip3 install -U --break-system-packages yt-dlp || pip3 install -U yt-dlp
yt-dlp --version || echo "(yt-dlp shim ok via py -m yt_dlp)"

echo ">>> Adding daily yt-dlp auto-update..."
( crontab -l 2>/dev/null | grep -v 'yt-dlp' ; echo "0 4 * * * pip3 install -U --break-system-packages yt-dlp >/dev/null 2>&1" ) | crontab -

echo ">>> Opening firewall (22 / 80 / 443)..."
sudo ufw --force enable || true
sudo ufw allow OpenSSH || true
sudo ufw allow 80/tcp  || true
sudo ufw allow 443/tcp || true

# Oracle's iptables rules need this for HTTP/HTTPS to actually reach nginx:
if ! sudo iptables -L INPUT -n | grep -q 'tcp dpt:80'; then
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80  -j ACCEPT || true
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
  sudo netfilter-persistent save || sudo iptables-save | sudo tee /etc/iptables/rules.v4 >/dev/null || true
fi

echo ""
echo "✅ Base setup complete."
echo ""
echo "Next steps:"
echo "  1. Create /home/ubuntu/mediaflow/.env with your real values."
echo "  2. cd ~/mediaflow && bash deploy/deploy.sh"
echo "  3. Configure nginx: deploy/ORACLE_DEPLOY.md → step 8."
