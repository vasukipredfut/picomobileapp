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

## Desk layout (full width + white sidebar)

`public/css/desk_layout.css` (also loaded via `app_include_css` +
`web_include_css`, alongside `company_branding.css` — both hooks are now
lists):
- **Full width by default** — "full width" is otherwise only a per-browser
  `localStorage.container_fullwidth` toggle
  (`frappe.ui.toolbar.toggle_full_width` in `toolbar.js`), so there's no
  server-side "default" to flip; this reproduces the same effect
  unconditionally (`.container { width: 90%; max-width: 100% }` /
  `.page-body { width: 100%; max-width: 100% }`) instead.
- **White sidebar** — forces `.desk-sidebar`/`.standard-sidebar` to a white
  background with dark text, overriding whatever gave it a dark background
  by default.
- **Icon color matches the navbar exactly** — `.sidebar-item-icon` is set to
  `var(--navbar-bg)`, the same CSS variable the top navbar itself uses for
  its background, so it tracks the real configured navbar color rather than
  a hardcoded guess.

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
6. Copy `custom_theme/custom_theme/public/css/company_branding.css` into
   `apps/custom_theme/custom_theme/public/css/` on the target bench.
7. Run `bench --site <site> migrate` (syncs the patches *and* the new
   doctype table in one pass), then restart the bench web process so the new
   hooks and the monkeypatch (it only runs once, at process import) are
   loaded.

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
