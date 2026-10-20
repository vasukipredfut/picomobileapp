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
	"""update_website_context hook: swap the public website header logo and the
	browser tab favicon per company. Covers the desk shell (/app) too, since
	it's rendered through this same website context pipeline."""
	logo = get_company_logo()
	if logo:
		context["banner_image"] = logo
		context["favicon"] = logo
