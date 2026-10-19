# AI 2053: notes for coding agents

Read `README.md` first. The site is plain ES modules and CSS under `public/`: no build
step, no npm dependencies, no CDNs or remote fonts.

- It is authored fiction. Every institution, model and figure is invented; nothing is
  attributed to real people or organisations. The UI carries no disclaimers or explanations
  of the joke; the fiction is stated only in the page metadata.
- Room data lives in `public/house/rooms*.js`. Plan targets (`doors[].to`) are the graph:
  changing them changes the walk's pacing and the house's one exit, so change them only
  deliberately, and never add hints, recommended routes or a narrator.
- Every plan is a real link (`main a[data-to]`), keyboard-reachable with visible focus.
  Effects never cover, move or disable a plan. `prefers-reduced-motion` gets static
  states. 390px is first-class.
- Run `npm run check` after editing modules. Deploy only from a clean, reviewed `main`
  (see README).

Working notes for the maintainers' own agents live in `private/` (ignored, not published).
