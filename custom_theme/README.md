# custom_theme Frappe desk patches

Two independent, idempotent patches for the Frappe/ERPNext desk sidebar, plus
a small doctype + hook pair for per-company branding.

## setup_sidebar_menu

Adds a nested sidebar: HR Module, Payroll Module, Expense Module, Sales
Module, Service Module as top-level entries, each with its doctypes listed
as children (User, Employee, Leave Application, etc.). Clicking a child goes
straight to that doctype's list view.

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

## Company Branding (per-company logo)

A new `Company Branding` doctype (`company` Link, unique + `logo` Attach
Image — one record per company) plus two hooks that resolve the current
company (logged-in user's default company via `erpnext.get_default_company()`,
falling back to Global Defaults) and swap in that company's logo wherever
`custom_theme` already controls the page:

- `update_website_context` — swaps the public website header logo
  (`banner_image`) per visitor's resolved company.
- `boot_session` — swaps the desk navbar logo (`app_logo_url`) per the
  logged-in user's resolved company.

Falls through to the normal Website Settings logo when no `Company Branding`
record exists for the resolved company, so unbranded companies aren't broken.
Core `Company` doctype is untouched — this is fully additive, living only in
`custom_theme`.

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
4. Add the `update_website_context` and `boot_session` hook lines from
   `custom_theme/custom_theme/hooks.py` (see the copy here) into the target
   bench's `apps/custom_theme/custom_theme/hooks.py`.
5. Run `bench --site <site> migrate` (syncs the patches *and* the new
   doctype table in one pass), then restart the bench web process so the new
   hooks are loaded.

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
