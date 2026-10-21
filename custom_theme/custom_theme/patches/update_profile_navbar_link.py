import frappe

NEW_ROUTE = "/app/my-preferences"


def execute():
	"""Point the navbar's standard "My Profile" item at our custom My
	Preferences page instead of the stock /app/user-profile page."""
	navbar_settings = frappe.get_single("Navbar Settings")
	changed = False

	for item in navbar_settings.settings_dropdown:
		if item.item_label == "My Profile" and item.route != NEW_ROUTE:
			item.route = NEW_ROUTE
			changed = True

	if changed:
		navbar_settings.save(ignore_permissions=True)
		frappe.db.commit()
