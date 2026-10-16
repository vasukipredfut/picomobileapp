# custom_theme sidebar patch

Adds a nested Frappe desk sidebar: HR Module, Payroll Module, Expense Module,
Sales Module, Service Module as top-level entries, each with its doctypes
listed as children (User, Employee, Leave Application, etc.). Clicking a
child goes straight to that doctype's list view.

## Apply on a server

1. Copy `custom_theme/custom_theme/patches/setup_sidebar_menu.py` and
   `custom_theme/custom_theme/patches/__init__.py` into
   `apps/custom_theme/custom_theme/patches/` on the target bench.
2. Add `custom_theme.patches.setup_sidebar_menu` under the `[post_model_sync]`
   section of `apps/custom_theme/custom_theme/patches.txt` (see the copy here
   for reference).
3. Make sure the `custom_theme` app is installed on the site
   (`bench --site <site> install-app custom_theme`).
4. Run `bench --site <site> migrate`.

The patch is idempotent — it checks for existing Workspace records before
creating new ones, so re-running `migrate` is safe.
