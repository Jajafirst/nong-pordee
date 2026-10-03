#!/bin/sh
# Publishes only the built website (dist/index.html) to the public Pages repo; the source stays in the private repo.
# Usage: npm run deploy
set -e
SITE_REPO="${SITE_REPO:-git@github.com:Jajafirst/nong-pordee-app.git}"
node build.mjs
TMP=$(mktemp -d)
cp dist/index.html "$TMP/index.html"
touch "$TMP/.nojekyll"
cd "$TMP"
git init -q -b main
git add -A
git -c user.name="Jajafirst" -c user.email="Jajafirst@users.noreply.github.com" commit -q -m "Publish website $(date +%Y-%m-%d)"
git push -q -f "$SITE_REPO" main
cd - >/dev/null && rm -rf "$TMP"
echo "Published. Site: https://jajafirst.github.io/$(basename "$SITE_REPO" .git)/"
