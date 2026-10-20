import erpnext
import frappe


def get_company_logo(company=None):
	"""Logo uploaded on Company Branding for the given (or current default) company."""
	company = company or erpnext.get_default_company()
	if not company:
		return None

	return frappe.db.get_value("Company Branding", company, "logo", cache=True)


def update_website_context(context):
	"""update_website_context hook: swap the public website header logo per company."""
	logo = get_company_logo()
	if logo:
		context["banner_image"] = logo


def set_company_logo_in_boot(bootinfo):
	"""boot_session hook: swap the desk navbar logo per the logged-in user's default company."""
	logo = get_company_logo()
	if logo:
		bootinfo.app_logo_url = logo
