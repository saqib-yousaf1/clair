#!/bin/bash
set -euo pipefail

DEPLOY_DIR="/home/ubuntu/deploy"
HOME_APP_DIR="/home/ubuntu/living-wall-2"
FRONTEND_TAR="$DEPLOY_DIR/frontend-dist.tar.gz"
BACKEND_TAR="$DEPLOY_DIR/backend.tar.gz"

# Ensure app dir exists and owned by ubuntu
mkdir -p "$HOME_APP_DIR"
chown -R ubuntu:ubuntu "$HOME_APP_DIR"

# --------- Frontend deploy ----------
if [ -f "$FRONTEND_TAR" ]; then
  echo "Deploying frontend from $FRONTEND_TAR"

  TMPDIR=$(mktemp -d)
  tar -xzf "$FRONTEND_TAR" -C "$TMPDIR"

  # Case A: tarball contains a top-level 'dist' directory
  if [ -d "$TMPDIR/dist" ]; then
    echo "Tarball contains dist/. Moving dist -> $HOME_APP_DIR/dist"
    rm -rf "$HOME_APP_DIR/dist"
    mv "$TMPDIR/dist" "$HOME_APP_DIR/dist"
  else
    # Case B: tarball contains files directly (index.html + assets/)
    echo "Tarball does not contain dist/; creating $HOME_APP_DIR/dist and moving contents"
    rm -rf "$HOME_APP_DIR/dist"
    mkdir -p "$HOME_APP_DIR/dist"
    mv "$TMPDIR"/* "$HOME_APP_DIR/dist/" || true
  fi

  # Ensure ownership and permissions for nginx (www-data).
  # Use sudo to handle cases where tar extracted files as root.
  sudo chown -R ubuntu:www-data "$HOME_APP_DIR/dist" || true
  # Directories should be readable/traversable by nginx, files should be readable only.
  sudo find "$HOME_APP_DIR/dist" -type d -exec chmod 755 {} \; || true
  sudo find "$HOME_APP_DIR/dist" -type f -exec chmod 644 {} \; || true

  # cleanup
  rm -rf "$TMPDIR"
fi

# --------- Backend deploy ----------
# If backend tarball exists, extract to deploy dir and move into place
if [ -f "$BACKEND_TAR" ]; then
  echo "Extracting backend tarball"
  rm -rf "$DEPLOY_DIR/backend"
  mkdir -p "$DEPLOY_DIR/backend"
  tar -xzf "$BACKEND_TAR" -C "$DEPLOY_DIR"
fi

if [ -d "$DEPLOY_DIR/backend" ]; then
  echo "Moving backend into $HOME_APP_DIR/backend"
  rm -rf "$HOME_APP_DIR/backend"
  mv "$DEPLOY_DIR/backend" "$HOME_APP_DIR/backend"

  cd "$HOME_APP_DIR/backend"
  npm ci --production

  # start or restart pm2
  if pm2 list | grep -q living-wall-backend; then
    pm2 restart living-wall-backend || pm2 start index.js --name living-wall-backend
  else
    pm2 start index.js --name living-wall-backend
  fi
  pm2 save
fi

# reload nginx gracefully
sudo systemctl reload nginx || true

echo "Deploy finished"
