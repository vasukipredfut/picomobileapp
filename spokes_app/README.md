# spokes_app sidebar theme fix

`public/css/deskk.min.css` is a copy of the real file at
`apps/spokes_app/spokes_app/public/css/deskk.min.css` on the pico.com bench,
with the left navigation sidebar's colors changed:

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

## Apply on the server

```bash
cp ~/frappe-bench/apps/spokes_app/spokes_app/public/css/deskk.min.css \
   ~/frappe-bench/apps/spokes_app/spokes_app/public/css/deskk.min.css.bak

curl -s -o ~/frappe-bench/apps/spokes_app/spokes_app/public/css/deskk.min.css \
  https://raw.githubusercontent.com/vasukipredfut/picomobileapp/main/spokes_app/public/css/deskk.min.css

cd ~/frappe-bench
bench build --app spokes_app
# then restart the web process (see custom_theme/README.md for finding the
# right supervisor group name on this server)
```
