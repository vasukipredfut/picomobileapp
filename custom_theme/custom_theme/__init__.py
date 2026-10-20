__version__ = "0.0.1"


def _patch_desk_app_logo():
	"""frappe.boot.get_bootinfo() calls boot_session hooks *before* it sets
	bootinfo.app_logo_url (see frappe/boot.py), so a boot_session hook can
	never win against the default app_logo_url. Patching the function boot.py
	calls is the only way to make the desk navbar logo company-aware."""
	import frappe.boot

	original_get_app_logo = frappe.boot.get_app_logo

	def get_app_logo():
		from custom_theme.utils import get_company_logo

		return get_company_logo() or original_get_app_logo()

	frappe.boot.get_app_logo = get_app_logo


_patch_desk_app_logo()
