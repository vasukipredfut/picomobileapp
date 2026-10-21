# custom_theme Frappe desk patches

Two independent, idempotent patches for the Frappe/ERPNext desk sidebar, plus
a small doctype + hook pair for per-company branding.

## setup_sidebar_menu

Adds a nested sidebar: HR Module, Payroll Module, Expense Module, Sales
Module, Service Module, Settings as top-level entries, each with its
doctypes listed as children (User, Employee, Leave Application, Company,
Company Branding, etc.). Clicking a child goes straight to that doctype's
list view. Upserts by internal label (`"{module title} - {doctype}"`), so
re-running after adding/renaming an entry updates existing Workspace records
in place instead of creating duplicates; a missing DocType is skipped with a
logged error rather than failing the whole patch.

## setup_company_dashboard

Adds a top-level **Company Dashboard** workspace (not named "Dashboard" —
that collides with Frappe's built-in Dashboard DocType) with:
- A welcome banner reading "Welcome to `<company>`", resolved live per
  logged-in user via `frappe.defaults.get_user_default("Company")`.
- Number cards for Number of Leads, Number of Customers, Number of
  Installation Reports — Leads and Installation Reports are scoped to the
  logged-in user's default company (same `dynamic_filters_json` pattern
  stock ERPNext uses for "Annual Sales"/"Annual Purchase"); Customers is
  global since the Customer doctype has no simple top-level `company` field.

**Making it the landing page:** clicking the navbar logo (or any bare `/app`
hit) does **not** read any hook — it's pure client-side JS
(`workspace.js get_page_to_show()`): it checks the **User** doctype's
`default_workspace` field first, then `localStorage.current_page` (last
visited), then whichever Workspace has the lowest `sequence_id`. So to make
this dashboard the landing page for existing users, set that field directly
rather than relying on `sequence_id` ordering:
```python
for u in frappe.get_all("User", filters={"user_type": "System User"}, pluck="name"):
    frappe.db.set_value("User", u, "default_workspace", "<workspace name>")
frappe.db.commit()
```
(Run via `bench console`. This only affects existing users — it does not
apply automatically to a user created afterward.)

## Company Branding (per-company logo)

A new `Company Branding` doctype (`company` Link, unique + `logo` Attach
Image — one record per company) plus hooks that resolve the current company
and swap in that company's logo wherever `custom_theme` already controls the
page. Falls through to the normal Website Settings logo when no
`Company Branding` record exists for the resolved company, so unbranded
companies aren't broken. Core `Company` doctype is untouched — this is fully
additive, living only in `custom_theme`.

**Company resolution** (`get_current_company()` in `utils.py`): the logged-in
user's Company via their `User Permission` (`allow=Company`), preferring one
marked "Is Default" if they have several — **not**
`erpnext.get_default_company()`, which only reads a separate per-user Default
value that a Company User Permission does not populate, so it silently stays
on the site's global default company for a user who's merely restricted to
one company. Falls back to the site's Global Default Company for
unrestricted users (e.g. Guest visitors on the public website).

**Where it hooks in:**
- `update_website_context` hook — swaps the public website header logo
  (`banner_image`) and the browser tab favicon per visitor's resolved
  company. This same context pipeline renders the desk shell (`/app`), so
  it covers the desk favicon too.
- The desk **navbar** logo (`frappe.boot.app_logo_url`) needs a different
  fix: `frappe/boot.py`'s `get_bootinfo()` runs `boot_session` hooks
  *before* it sets `bootinfo.app_logo_url`, so a `boot_session` hook can
  never win against the default — it gets overwritten right after. Instead,
  `custom_theme/__init__.py` monkeypatches `frappe.boot.get_app_logo` itself
  (the function `boot.py` actually calls) at app-load time, falling back to
  the original function when no company logo is set.
- `public/css/company_branding.css` (loaded via `app_include_css` +
  `web_include_css`) — Frappe caps the logo tiny by default
  (`.app-logo { width: 24px }` in desk, `.navbar-brand img { max-height: 22px }`
  on the website); this raises both ceilings so an uploaded company logo
  actually reads as a logo instead of a postage stamp. Favicon size isn't
  adjustable this way — browsers always render a tab icon tiny regardless of
  the source image's dimensions.

## Desk layout (full width + hidden navbar items)

`public/css/desk_layout-v3.css` (also loaded via `app_include_css` +
`web_include_css`, alongside `company_branding.css` — both hooks are now
lists). **Full width by default** — "full width" is otherwise only a
per-browser `localStorage.container_fullwidth` toggle
(`frappe.ui.toolbar.toggle_full_width` in `toolbar.js`), so there's no
server-side "default" to flip; this reproduces the same effect
unconditionally (`.container { width: 90%; max-width: 100% }` /
`.page-body { width: 100%; max-width: 100% }`) instead.

**Notification bell and Help dropdown hidden** — `.navbar
.dropdown-notifications, .navbar .dropdown-help { display: none !important
}`. These are the exact `<li>` wrapper classes Frappe's own
`navbar.html` uses for these two items (confirmed from Frappe's source, not
guessed).

This file **used to also** own the white-sidebar/blue-icon styling, but that
duplicated (and, on this bench, actively fought) what `spokes_app`'s
`deskk-v3.min.css` already does — see `spokes_app/README.md`. The icon-color
rule here used `var(--navbar-bg)`, which resolves to Frappe's own default
("white") on this bench, since the navbar's real background is a hardcoded
gradient in `spokes_app`'s CSS that never touches that custom property. Since
`custom_theme` loads after `spokes_app` (apps.txt order) and both used
`!important`, this file's white rule silently beat `spokes_app`'s correct
blue one. Removed here entirely rather than fixed in place, so there's one
clear owner of sidebar styling going forward instead of two apps able to
fight over the same elements again. Renamed `desk_layout.css` →
`desk_layout-v2.css` → `desk_layout-v3.css` (the latter for the
hide-navbar-items addition) for the same cache-busting reason as
`spokes_app`'s renames (see that README) — this bench's dev server caches
`/assets/` for 12 hours, so editing in place wasn't enough even just for
testing.

## Per-user Theme Preferences

A new **Theme Preference** doctype (`user` Link, unique + `app_color`,
`primary_color`, `secondary_color`, `button_style`, `font_size`, `light_mode`
— one record per user, created on first Save) plus a new desk **Page** at
`/app/my-preferences` ("My Preferences", open to any logged-in user) with
color swatches, button-style and font-size pickers, and live preview
buttons. Per-user by design — each person sets their own, not an
admin-controlled site-wide setting.

**What's actually wired to take effect app-wide** (the rest — primary/
secondary color, button style — are stored and shown in the page's own
preview, but don't currently cascade elsewhere; say the word if you want
those applied globally too, e.g. to form buttons):
- **App Color** → the desk navbar background and every sidebar module icon
  (`.sidebar-item-icon .icon-md`), overriding `spokes_app`'s navbar gradient
  and icon color with a user-chosen solid color.
- **Font Size** (Small/Medium/Large) → the desk navbar text and the content
  font size on `/app/my-preferences` and the standard `/app/user-profile`
  page specifically — not the whole desk.

**How it works:**
- `custom_theme/custom_theme/page/my_preferences/my_preferences.js` builds
  the UI and calls two whitelisted methods on the doctype
  (`get_my_preferences`/`save_my_preferences`, both scoped to
  `frappe.session.user` server-side — a user can only ever read/write their
  own record). Clicking a swatch/button applies live immediately (before
  Save) by injecting a `<style id="custom-theme-preference-style">` tag and
  toggling a `theme-font-{size}` class on `<body>`.
- `utils.set_theme_preference_in_boot`, wired via the `boot_session` hook,
  embeds the saved preference into
  `frappe.boot.custom_theme_preference` on every page's boot. Unlike the
  `app_logo_url` case documented above, a `boot_session` hook **is** safe
  here — the ordering problem there was specific to a key `boot.py` itself
  re-assigns later; an arbitrary new key like this one is never touched
  again after `boot_session` runs.
- `public/js/apply_theme_preference-v2.js` (loaded via `app_include_js`)
  reads `frappe.boot.custom_theme_preference` and applies the same style
  injection as the live-preview code, so a saved preference persists across
  page loads and new sessions, not just while on the preferences page. It
  polls for `frappe.boot` to exist rather than calling `frappe.ready()`
  directly — `app_include_js` scripts aren't guaranteed to run after
  Frappe's core bundle has defined `frappe.ready` yet, which is a real bug
  that showed up in testing (`frappe.ready is not a function`).
- **Critical, easy-to-miss step**: `frappe.boot` is cached **per-user** in
  Redis (`frappe.cache.hget("bootinfo", user)`, one of the keys
  `frappe.clear_cache(user=...)` clears). `save_my_preferences` calls
  `frappe.clear_cache(user=frappe.session.user)` after saving — **without
  this, the saved preference silently never appears on any other page load**
  (confirmed by hitting exactly this bug during testing), since every
  subsequent page keeps getting the pre-save cached bootinfo. If you ever
  add another field/flow that changes this doctype outside
  `save_my_preferences`, it needs the same cache-clear.

**Making it reachable from the navbar:** the desk navbar's "My Profile"
dropdown item is a seeded row in the **Navbar Settings** doctype
(`settings_dropdown` child table, `item_label="My Profile"`,
`route=/app/user-profile`) — not something any hook currently touches. The
`update_profile_navbar_link` patch (`[post_model_sync]` in `patches.txt`,
same idempotent-patch convention as `setup_sidebar_menu`/
`setup_company_dashboard`) repoints that row to `/app/my-preferences`. Since
it's a genuinely new patch (not an edit to an already-applied one), a normal
`bench migrate` runs it automatically — no console-exec workaround needed,
unlike the "updating an already-applied patch" case above. Also note
`frappe.boot.navbar_settings` is itself cached the same way `bootinfo` is
(`frappe.get_cached_doc("Navbar Settings")`), so a plain DB edit outside
this patch would need `frappe.clear_cache()` too to show up immediately.

**App Color now covers three elements, not just the navbar** — found by
actually checking what the screenshots showed after the first version
shipped (a visibly two-toned header, and an unchanged welcome banner):
- `.navbar` *and* `.page-head.flex` (the page-title bar directly under the
  navbar) are set to the **same** color, which is what makes them read as
  one continuous bar instead of two visibly different-colored stacked
  layers — merely coloring the navbar was the original bug here, not a
  separate "merge" step.
- `.pico-welcome-banner` (the Home Dashboard's welcome banner) — this one
  took two attempts. Its markup/style come from a `Custom HTML Block`
  document's `html`/`style` fields ("Pico Dashboard Welcome Banner") in the
  DB, not any CSS file — but critically, **Frappe renders that block inside
  an open Shadow DOM** (confirmed live:
  `customEl.shadowRoot.mode === "open"`). A plain `.pico-welcome-banner
  { background: ... !important }` rule in a page-level `<style>` tag — the
  first thing tried — has **zero** effect here no matter how it's written:
  Shadow DOM is intentionally style-isolated, and external CSS cannot cross
  that boundary at all, `!important` or not. The actual fix:
  `colorWelcomeBanner()` in `apply_theme_preference-v4.js` (and
  `color_welcome_banner()` in `my_preferences.js`) finds the block's host
  element, reaches into `host.shadowRoot`, and sets the inline style
  directly on the banner element inside it
  (`banner.style.setProperty("background", color, "important")`). Since the
  block loads asynchronously (only present on workspaces that include it,
  well after page boot), both wrap this in a `MutationObserver` watching for
  the block to appear rather than assuming it's already there.

**Logo made rectangular, not square** — `company_branding.css`'s
`.app-logo` previously forced `width: 40px; height: 40px`, which
squished/cropped any non-square uploaded logo into a square. Changed to
`height: 40px; width: auto; max-width: 140px`, so it sizes to the uploaded
image's own real aspect ratio (verified live: a 1920×1080 test logo now
renders at a proportional 71×40, not forced to 40×40).

Renamed `company_branding.css` → `company_branding-v2.css` for the same
cache-busting reason as every other file in this app — worth calling out
specifically here, since it had kept its *original* filename this entire
project, so this was the first time it ever needed a cache-bust, and the
old 40×40-square version was still being served to any browser that had
loaded it even once before. `apply_theme_preference.js` went through two
more renames in this same round (`v2` → `v3` → `v4`) as the welcome-banner
fix above was developed and corrected.

## Apply on a server

If `custom_theme` is already installed as an app on the target bench:

1. Copy both files from `custom_theme/custom_theme/patches/` into
   `apps/custom_theme/custom_theme/patches/` on the target bench.
2. Add both lines under `[post_model_sync]` in
   `apps/custom_theme/custom_theme/patches.txt` (see the copy here).
3. Copy `custom_theme/custom_theme/custom_theme/doctype/company_branding/`
   into `apps/custom_theme/custom_theme/custom_theme/doctype/` on the target
   bench, and `custom_theme/custom_theme/utils.py` into
   `apps/custom_theme/custom_theme/utils.py` (merge if that file already has
   other content).
4. Add the `update_website_context`, `app_include_css`, and `web_include_css`
   hook lines from `custom_theme/custom_theme/hooks.py` (see the copy here)
   into the target bench's `apps/custom_theme/custom_theme/hooks.py`.
5. Merge the `_patch_desk_app_logo()` function and its call from
   `custom_theme/custom_theme/__init__.py` (see the copy here) into the
   target bench's `apps/custom_theme/custom_theme/__init__.py`.
6. Copy `custom_theme/custom_theme/public/css/company_branding-v2.css` into
   `apps/custom_theme/custom_theme/public/css/` on the target bench, and
   make sure `hooks.py`'s `app_include_css`/`web_include_css` reference this
   current filename (it's been renamed a few times for cache-busting — see
   "Why the renames" sections — always check this repo's current `hooks.py`
   rather than assuming a filename from an earlier step here).
7. Run `bench --site <site> migrate` (syncs the patches *and* the new
   doctype table in one pass), then restart the bench web process so the new
   hooks and the monkeypatch (it only runs once, at process import) are
   loaded.
8. For **Theme Preferences**: copy
   `custom_theme/custom_theme/custom_theme/doctype/theme_preference/` into
   `apps/custom_theme/custom_theme/custom_theme/doctype/`, and
   `custom_theme/custom_theme/custom_theme/page/my_preferences/` into
   `apps/custom_theme/custom_theme/custom_theme/page/` (create that `page/`
   folder with an empty `__init__.py` if it doesn't already exist on the
   target bench — see `custom_theme/custom_theme/custom_theme/page/__init__.py`
   here).
9. Copy `public/js/apply_theme_preference-v2.js` and
   `public/css/theme_preference.css` into the target bench's matching
   `apps/custom_theme/custom_theme/public/js/` and `.../public/css/`
   folders.
10. Add the `app_include_js` and `boot_session` hook lines, and the
    `theme_preference.css` entry in `app_include_css`, from
    `custom_theme/custom_theme/hooks.py` (see the copy here) into the target
    bench's `hooks.py`.
11. Run `bench --site <site> migrate` again (creates the `Theme Preference`
    table and registers the `my-preferences` Page) and restart the web
    process.

If `custom_theme` is **not** installed as an app on the target bench (no
need to install a new app just for this), run each patch directly via
`bench console` instead — it only touches the Workspace/Number
Card/Custom HTML Block doctypes, nothing else:

```python
exec(open('/path/to/setup_sidebar_menu.py').read(), globals())
frappe.flags.in_migrate = True   # bypasses the "name collides with a doctype route" guard, safely — the same flag bench migrate itself sets
execute()
frappe.db.commit()
```

```python
exec(open('/path/to/setup_company_dashboard.py').read(), globals())
execute()
frappe.db.commit()
```

Both patches check for existing records by name/label before creating
anything new, so re-running them is safe. Company Branding needs the real
doctype (step 3 above) — it can't be applied as a standalone console script.

**Updating an already-applied patch:** `[post_model_sync]` patches are
tracked in Patch Log once run, so `bench migrate` will **not** re-run one
just because its file content changed — you have to re-run it directly via
the `bench console` snippets above (safe/idempotent either way), even on a
bench where `custom_theme` is installed as a real app.
