# Warm glass verification

See [asset provenance](ASSET.md) and [implementation plan](../../plans/warm-glass-theme.md).
No screenshots are committed. Use a locally available Playwright installation and
Chromium to run the fixture-backed production smoke check:

```sh
NODE_PATH=/path/to/external/node_modules \
BASE_URL=http://localhost:9999 THEME=true OUTPUT_DIR=/tmp/warm-glass \
node hindsight-control-plane/tests/custom/theme/browser.cjs
```

Run against separately built flag-off and flag-on servers; omit `THEME` for the
flag-off run. The script checks loaded CSS/wallpaper, all bank navigation links,
fullscreen layering, light/dark 390/768/1440px layouts, page errors and reduced
transparency. Its synthetic API fixtures do not exercise live retention/recall or
authentication. Output stays outside the repository. Upload captures to the PR or
a separate documentation branch for review. Exact executed commands and outcomes
belong in the PR verification comment, not a permanently green claim in this file.
