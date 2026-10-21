# Copyright (c) 2026, vasuki and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

FIELDS = ["app_color", "primary_color", "secondary_color", "button_style", "font_size", "light_mode"]


class ThemePreference(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		app_color: DF.Data | None
		button_style: DF.Literal["Pill", "Rounded", "Square"]
		font_size: DF.Literal["Small", "Medium", "Large"]
		light_mode: DF.Check
		primary_color: DF.Data | None
		secondary_color: DF.Data | None
		user: DF.Link

	# end: auto-generated types
	pass


@frappe.whitelist()
def get_my_preferences():
	user = frappe.session.user
	if not frappe.db.exists("Theme Preference", user):
		return {}

	doc = frappe.get_doc("Theme Preference", user)
	return {field: doc.get(field) for field in FIELDS}


@frappe.whitelist()
def save_my_preferences(**kwargs):
	user = frappe.session.user

	if frappe.db.exists("Theme Preference", user):
		doc = frappe.get_doc("Theme Preference", user)
	else:
		doc = frappe.new_doc("Theme Preference")
		doc.user = user

	for field in FIELDS:
		if field in kwargs:
			doc.set(field, kwargs[field])

	doc.save(ignore_permissions=True)
	frappe.db.commit()

	# bootinfo (which embeds this preference, via set_theme_preference_in_boot)
	# is cached per-user — without this, the next page load anywhere in the
	# app would keep serving the pre-save cached bootinfo and never pick up
	# what was just saved.
	frappe.clear_cache(user=user)

	return {field: doc.get(field) for field in FIELDS}


@frappe.whitelist()
def get_my_profile():
	user = frappe.get_doc("User", frappe.session.user)

	if user.role_profile_name:
		role = user.role_profile_name
	else:
		roles = [r.role for r in user.roles if r.role not in ("All", "Guest")]
		role = roles[0] if roles else user.user_type

	return {
		"full_name": user.full_name,
		"email": user.name,
		"phone": user.phone,
		"username": user.username or user.name,
		"role": role,
	}


@frappe.whitelist()
def save_my_profile(full_name=None, phone=None):
	user = frappe.get_doc("User", frappe.session.user)
	if full_name is not None:
		user.full_name = full_name
	if phone is not None:
		user.phone = phone
	user.save(ignore_permissions=True)
	frappe.db.commit()
	return {"full_name": user.full_name, "phone": user.phone}
