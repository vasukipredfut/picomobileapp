import frappe
from frappe.query_builder.functions import Concat_ws, Date


def execute(filters=None):
	filters = filters or {}
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_columns():
	# Trimmed down from erpnext's own "Lead Details" report: Territory,
	# Source, and Postal Code dropped per request ("remove
	# territory,source,postal"), which also narrows the table enough to stop
	# it overflowing the page width ("it shows half only").
	return [
		{"label": "Lead", "fieldname": "name", "fieldtype": "Link", "options": "Lead", "width": 150},
		{"label": "Lead Name", "fieldname": "lead_name", "fieldtype": "Data", "width": 120},
		{"label": "Status", "fieldname": "status", "fieldtype": "Data", "width": 100},
		{"label": "Lead Owner", "fieldname": "lead_owner", "fieldtype": "Link", "options": "User", "width": 120},
		{"label": "Email", "fieldname": "email_id", "fieldtype": "Data", "width": 150},
		{"label": "Mobile", "fieldname": "mobile_no", "fieldtype": "Data", "width": 120},
		{"label": "Phone", "fieldname": "phone", "fieldtype": "Data", "width": 120},
		{"label": "Owner", "fieldname": "owner", "fieldtype": "Link", "options": "User", "width": 120},
		{"label": "Company", "fieldname": "company", "fieldtype": "Link", "options": "Company", "width": 140},
		{"label": "Address", "fieldname": "address", "fieldtype": "Data", "width": 170},
		{"label": "City", "fieldname": "city", "fieldtype": "Data", "width": 100},
		{"label": "State", "fieldname": "state", "fieldtype": "Data", "width": 100},
		{"label": "Country", "fieldname": "country", "fieldtype": "Link", "options": "Country", "width": 100},
	]


def get_data(filters):
	lead = frappe.qb.DocType("Lead")
	address = frappe.qb.DocType("Address")
	dynamic_link = frappe.qb.DocType("Dynamic Link")

	query = (
		frappe.qb.from_(lead)
		.left_join(dynamic_link)
		.on((lead.name == dynamic_link.link_name) & (dynamic_link.parenttype == "Address"))
		.left_join(address)
		.on(address.name == dynamic_link.parent)
		.select(
			lead.name,
			lead.lead_name,
			lead.status,
			lead.lead_owner,
			lead.email_id,
			lead.mobile_no,
			lead.phone,
			lead.owner,
			lead.company,
			(Concat_ws(", ", address.address_line1, address.address_line2)).as_("address"),
			address.city,
			address.state,
			address.country,
		)
		.where(lead.company == filters.get("company"))
		.where(Date(lead.creation).between(filters.get("from_date"), filters.get("to_date")))
	)

	return query.run(as_dict=1)
