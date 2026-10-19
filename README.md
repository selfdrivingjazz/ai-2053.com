# AI 2053

**The House of 2053**: a detailed forecast of the years 2041 to 2053, set out room by room.
An interactive fiction. Every institution, model and figure in it is invented.

https://ai-2053.com

## Running it locally

There is no build step and there are no dependencies. The site is `public/` as committed.

```sh
npm start            # node server.mjs → http://127.0.0.1:4333 (PORT/HOST to override)
npm run check        # node --check on the server and every module
```

The local server is a preview: it sends `X-Robots-Tag: noindex, nofollow` on every
response. `/healthz` answers `ai2053-ready`.

To run the production configuration locally (Cloudflare Workers static assets):

```sh
npx wrangler@4 dev
```

## Deploying

The site is a Cloudflare Worker with static assets and no Worker code (`wrangler.jsonc`).
From a clean checkout of `main`:

```sh
npx wrangler@4 deploy
```

What ships, and how it is served:

- `public/` is the asset directory. `public/.assetsignore` keeps the social-card sources
  (`media/og/*.html`) and the full-size originals in `shared/media/` out of the upload.
- `public/_headers`: `nosniff` and a referrer policy everywhere, a content security policy
  on the page (`/`), one-week caching for `/media/*` and `/shared/*`, and `noindex` on
  `/reset/`.
- `public/_redirects`: retired `/x/*` URLs go to `/`.
- Directories get a trailing slash (`html_handling: auto-trailing-slash`).
- Rooms are states of the one document (`/#room-N`), so there are no other routes to serve.
- `public/robots.txt` allows everything but `/reset/`.

`/reset/` is an unlinked tool for reviewers: it clears this site's own browser storage
(`ai2053.*` keys) and returns to the first room.

## Layout

| Path | What it is |
|---|---|
| `public/index.html` | the page and its metadata |
| `public/house/` | the house: controller (`house.js`), room data (`rooms*.js`), room modules and styles |
| `public/media/eng/` | grayscale plate derivatives used by the engraving worker |
| `public/media/og/` | social card and icons (sources: `card.html`, `icon.html`) |
| `public/shared/fonts/` | ET Book (MIT, see `LICENSE-et-book.txt`) |
| `public/shared/media/` | the original images the derivatives were made from (not deployed) |
| `server.mjs` | the local preview server |

Plate imagery is the author's own, plus public-domain engravings (see the manifests).
