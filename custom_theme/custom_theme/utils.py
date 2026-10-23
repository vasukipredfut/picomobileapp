import frappe


def get_current_company():
	"""The logged-in user's Company, via their User Permission restricting
	them to one (preferring one marked Is Default if they have several) —
	not erpnext.get_default_company(), which only reads a separate per-user
	Default value that a Company User Permission does not populate. Falls
	back to the site's Global Default Company for unrestricted users."""
	user = frappe.session.user
	if user and user not in ("Administrator", "Guest"):
		companies = frappe.get_all(
			"User Permission",
			filters={"user": user, "allow": "Company"},
			order_by="is_default desc",
			pluck="for_value",
		)
		if companies:
			return companies[0]

	return frappe.db.get_single_value("Global Defaults", "default_company")


def get_company_logo(company=None):
	"""Logo uploaded on Company Branding for the given (or current) company."""
	company = company or get_current_company()
	if not company:
		return None

	return frappe.db.get_value("Company Branding", company, "logo", cache=True)


def update_website_context(context):
	"""update_website_context hook: swap the public website header logo, the
	browser tab favicon, and the boot-time splash screen logo per company.
	Covers the desk shell (/app) too, since it's rendered through this same
	website context pipeline. splash_image is a context key Frappe's own
	templates/includes/splash_screen.html already reads natively (it's also
	a stock Website Settings field) — no template override needed."""
	logo = get_company_logo()
	if logo:
		context["banner_image"] = logo
		context["favicon"] = logo
		context["splash_image"] = logo


def set_theme_preference_in_boot(bootinfo):
	"""boot_session hook: embed the logged-in user's saved Theme Preference (if
	any) into bootinfo, so apply_theme_preference.js can apply it on every page
	without an extra round-trip. Safe to set here (unlike app_logo_url) since
	nothing else in frappe/boot.py overwrites this key afterward — the ordering
	problem only applies to keys boot.py itself assigns later."""
	user = frappe.session.user
	if not user or user == "Guest" or not frappe.db.exists("Theme Preference", user):
		return

	from custom_theme.custom_theme.doctype.theme_preference.theme_preference import FIELDS

	doc = frappe.get_cached_doc("Theme Preference", user)
	bootinfo.custom_theme_preference = {field: doc.get(field) for field in FIELDS}


def set_current_company_in_boot(bootinfo):
	"""boot_session hook: embed the logged-in user's Company (via
	get_current_company()'s User Permission lookup, the same source of truth
	used everywhere else in this app) into bootinfo, so the sidebar Report
	shortcuts added in setup_sidebar_menu.py can pre-fill their company
	filter with the value this app actually considers "current" — not
	frappe.defaults.get_user_default("Company")/erpnext.get_default_company(),
	which do NOT reflect a Company User Permission at all (see
	get_current_company()'s own docstring). A separate boot_session entry
	(registered as a list in hooks.py) rather than folded into
	set_theme_preference_in_boot above, since that function returns early for
	any user without a saved Theme Preference — most users won't have one,
	and this needs to run for all of them."""
	bootinfo.custom_theme_current_company = get_current_company()
