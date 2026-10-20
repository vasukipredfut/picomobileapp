# Copyright (c) 2026, vasuki and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CompanyBranding(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		company: DF.Link
		logo: DF.AttachImage

	# end: auto-generated types

	def on_update(self):
		frappe.clear_cache()
