# spokes_app sidebar theme fix

`public/css/deskk-v2.min.css` is a copy of the real file that was at
`apps/spokes_app/spokes_app/public/css/deskk.min.css` on the pico.com bench
(renamed — see "Why the rename" below), with the left navigation sidebar's
colors changed:

- `.page-sidebar`, `.standard-sidebar-section.nested-container`,
  `.col-lg-2.layout-side-section` backgrounds: `#404040` → `#ffffff`
  (sidebar was dark, now white)
- Their paired text colors: `#ffffff` → `#1f2937` (was white-on-dark, now
  readable dark-on-white)
- Hover/selected/active sidebar-item states: `#000000` → `#f0f1f2` (hover) /
  `#e8eef7` (selected, active) — light highlights instead of solid black,
  consistent with a white sidebar
- `.sidebar-item-icon`-scoped icon fills/strokes: `white` → `#1572b6` (the
  darker stop of the navbar's own `linear-gradient(to right, #58ace4,
  #1572b6)`, so the icons read as "the same blue as the top bar")

Everything else — the navbar gradient itself, `.page-container` background,
`.form-sidebar`/`.list-sidebar` (a different UI surface — the form/list view
side panel, not this nav), the broad `.icon-md`/`:root --icon-stroke: white`
rules (left untouched on purpose: they also color icons sitting ON the blue
navbar, e.g. the notification bell — making those blue too would make them
invisible against the blue background), print/chevron/menu icon colors, and
every other rule — is unchanged from the original.

## Why the rename (deskk.min.css → deskk-v2.min.css)

nginx serves everything under `/assets/` with `Cache-Control: max-age=31536000`
(one year). Since the filename never changed, every browser that had already
loaded the old dark-sidebar version kept using its cached copy indefinitely —
editing the file in place fixed it on the server, but not in anyone's browser,
regardless of hard-refreshing (and there's no way to force *every* user's
browser to drop a year-long cache after the fact). Renaming the file is the
only fix that's airtight for every user on every role without relying on
manual action: the new URL has never been cached by anyone, so it's always a
guaranteed fresh fetch.

## Apply on the server

```bash
cp ~/frappe-bench/apps/spokes_app/spokes_app/public/css/deskk.min.css \
   ~/frappe-bench/apps/spokes_app/spokes_app/public/css/deskk.min.css.bak

curl -s -o ~/frappe-bench/apps/spokes_app/spokes_app/public/css/deskk-v2.min.css \
  https://raw.githubusercontent.com/vasukipredfut/picomobileapp/main/spokes_app/public/css/deskk-v2.min.css

# point the hook at the new filename
sed -i 's#/assets/spokes_app/css/deskk.min.css#/assets/spokes_app/css/deskk-v2.min.css#' \
  ~/frappe-bench/apps/spokes_app/spokes_app/hooks.py
grep -n "deskk" ~/frappe-bench/apps/spokes_app/spokes_app/hooks.py   # confirm it updated

cd ~/frappe-bench
bench build --app spokes_app
# then restart the web process (see custom_theme/README.md for finding the
# right supervisor group name on this server)
```

The old `deskk.min.css` file can stay in place (harmless, just unreferenced)
or be deleted once you've confirmed the new one is working.
