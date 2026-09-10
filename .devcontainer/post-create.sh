#!/usr/bin/env bash
set -euxo pipefail

mkdir -p /home/node/.ssh /home/node/.config/gh

if [ -d /tmp/.ssh ] && [ "$(ls -A /tmp/.ssh 2>/dev/null)" ]; then
  cp -a /tmp/.ssh/. /home/node/.ssh/
fi

if [ -d /tmp/gh-config ] && [ "$(ls -A /tmp/gh-config 2>/dev/null)" ]; then
  cp -a /tmp/gh-config/. /home/node/.config/gh/
fi

if [ -f /tmp/.gitconfig ]; then
  cp /tmp/.gitconfig /home/node/.gitconfig
fi

chmod 700 /home/node/.ssh
find /home/node/.ssh -type f -exec chmod 600 {} \;
find /home/node/.config/gh -type f -exec chmod 600 {} \;
chown -R node:node /home/node/.ssh /home/node/.config/gh /home/node/.gitconfig 2>/dev/null || true

cd /workspaces/tundraboard

if command -v gh >/dev/null 2>&1; then
  gh extension install github/gh-copilot || gh extension upgrade github/gh-copilot
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not available in this devcontainer. Rebuild the container so the Node feature is installed."
  exit 1
fi

node -v
npm -v

npm install -g @anthropic-ai/claude-code
npm install -g opencode-ai
claude --version
opencode --version

if [ ! -f .env ]; then
  cp .env.example .env
fi

npm install
npx prisma migrate dev --name init
npm run db:seed
