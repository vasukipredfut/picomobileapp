# spokes_app sidebar theme fix

`public/css/deskk-v5.min.css` is a copy of the real file that was at
`apps/spokes_app/spokes_app/public/css/deskk.min.css` on the pico.com bench
(renamed four times now — see "Why the renames" below), with the left
navigation sidebar's colors changed:

- `.page-sidebar`, `.standard-sidebar-section.nested-container`,
  `.col-lg-2.layout-side-section` backgrounds: `#404040` → `#ffffff`
  (sidebar was dark, now white)
- Their paired text colors: `#ffffff` → `#1f2937` (was white-on-dark, now
  readable dark-on-white)
- Hover/selected/active sidebar-item states: `#000000` → `#f0f1f2` (hover) /
  `#e8eef7` (selected, active) — light highlights instead of solid black,
  consistent with a white sidebar
- `.sidebar-item-icon`-scoped icon fills/strokes: `white` → `#378fcd` (the
  midpoint between the navbar's own `linear-gradient(to right, #58ace4,
  #1572b6)` stops — a closer visual match to the gradient's overall blue than
  either single endpoint)
- `.btn-reset.drop-icon.show-in-edit-mode` (the expand/collapse chevron next
  to a module with children, e.g. "HR Module ⌄"): `white` → `#1f2937`, and
  its `filter: brightness(0) invert(1)` → `filter: none` — that filter forces
  *any* fill/stroke to pure white regardless of what color is set, so it was
  the actual reason the chevron stayed invisible even after the fill/stroke
  colors were fixed the first time
- `.sidebar-child-item .sidebar-item-label` / `.sidebar-child-item
  .standard-sidebar-item` (nested dropdown entries — e.g. "User", "Employee"
  under "HR Module"): `font-weight: bold` → `400`. The parent group label
  (e.g. "HR Module" itself) keeps its bold weight for hierarchy; only the
  children inside the dropdown read lighter now.

Everything else — the navbar gradient itself, `.page-container` background,
`.form-sidebar`/`.list-sidebar` (a different UI surface — the form/list view
side panel, not this nav), the broad `.icon-md`/`:root --icon-stroke: white`
rules (left untouched on purpose: they also color icons sitting ON the blue
navbar, e.g. the notification bell — making those blue too would make them
invisible against the blue background), print/chevron/menu icon colors, and
every other rule — is unchanged from the original.

## Navbar + page-head "two layers" fix (v5)

`.navbar` and `.page-head.flex` (the page-title bar directly under the
navbar) already used the **identical** gradient —
`linear-gradient(to right, #58ace4, #1572b6)` — so on paper they should
have matched. They didn't, because each element computes that gradient
independently over its *own* width, and `.page-head.flex` is narrower than
`.navbar` (it starts after the sidebar, not at the screen edge). The same
"to right" gradient stretched across two different widths produces visibly
different colors at any given horizontal position — which is exactly the
seam reported, and it's a **default-state** bug: it happens for every user
regardless of whether they've ever touched `custom_theme`'s per-user Theme
Preference feature. Fixed by making both solid `#1572b6` (the gradient's
darker stop) instead of a gradient — a solid color is identical at every
width by construction, so it can't mismatch itself the way a gradient can.
`custom_theme`'s per-user `app_color` override (when a user has set one)
still applies on top via `!important` exactly as before; this only changes
what happens when no preference is set.

## Why the renames (deskk.min.css → deskk-v2 → deskk-v3 → deskk-v4 → deskk-v5)

nginx serves everything under `/assets/` with `Cache-Control: max-age=31536000`
(one year). Since the filename never changed, every browser that had already
loaded the old dark-sidebar version kept using its cached copy indefinitely —
editing the file in place fixed it on the server, but not in anyone's browser,
regardless of hard-refreshing (and there's no way to force *every* user's
browser to drop a year-long cache after the fact). Renaming the file is the
only fix that's airtight for every user on every role without relying on
manual action: the new URL has never been cached by anyone, so it's always a
guaranteed fresh fetch. Each subsequent version (`v3`, `v4`, ...) exists
because a follow-up fix changed the file's *content* again under the
previous name, which would have silently hit the exact same stale-cache
problem a second time — each future content change needs its own new
filename, permanently, not just this once.

## Apply on the server

```bash
cp ~/frappe-bench/apps/spokes_app/spokes_app/public/css/deskk-v4.min.css \
   ~/frappe-bench/apps/spokes_app/spokes_app/public/css/deskk-v4.min.css.bak

curl -s -o ~/frappe-bench/apps/spokes_app/spokes_app/public/css/deskk-v5.min.css \
  https://raw.githubusercontent.com/vasukipredfut/picomobileapp/main/spokes_app/public/css/deskk-v5.min.css

# point the hook at the new filename
sed -i 's#/assets/spokes_app/css/deskk-v4.min.css#/assets/spokes_app/css/deskk-v5.min.css#' \
  ~/frappe-bench/apps/spokes_app/spokes_app/hooks.py
grep -n "deskk" ~/frappe-bench/apps/spokes_app/spokes_app/hooks.py   # confirm it updated

cd ~/frappe-bench
bench build --app spokes_app
# then restart the web process (see custom_theme/README.md for finding the
# right supervisor group name on this server)
```

Older `deskk*.min.css` files can stay in place (harmless, just unreferenced)
or be deleted once you've confirmed the new one is working. **Any future
edit to this file must bump the filename again** — that's the whole
mechanism, not a one-time workaround.
