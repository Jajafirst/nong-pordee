#!/bin/sh
# Publishes the built website (dist/index.html) to the gh-pages branch, which GitHub Pages serves.
# Usage: npm run deploy
set -e
SITE_REPO="${SITE_REPO:-git@github.com:Jajafirst/nong-pordee.git}"
BRANCH="${BRANCH:-gh-pages}"
node build.mjs
TMP=$(mktemp -d)
cp dist/index.html "$TMP/index.html"
touch "$TMP/.nojekyll"
cd "$TMP"
git init -q -b "$BRANCH"
git add -A
git -c user.name="Jajafirst" -c user.email="Jajafirst@users.noreply.github.com" commit -q -m "Publish website $(date +%Y-%m-%d)"
git push -q -f "$SITE_REPO" "$BRANCH"
cd - >/dev/null && rm -rf "$TMP"
echo "Published. Site: https://jajafirst.github.io/$(basename "$SITE_REPO" .git)/"
