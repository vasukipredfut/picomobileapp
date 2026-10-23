import frappe


def execute(filters=None):
	filters = filters or {}
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_columns():
	return [
		{"label": "Customer", "fieldname": "name", "fieldtype": "Link", "options": "Customer", "width": 140},
		{"label": "Customer Name", "fieldname": "customer_name", "fieldtype": "Data", "width": 160},
		{"label": "Customer Group", "fieldname": "customer_group", "fieldtype": "Link", "options": "Customer Group", "width": 140},
		{"label": "Territory", "fieldname": "territory", "fieldtype": "Link", "options": "Territory", "width": 120},
		{"label": "Customer Type", "fieldname": "customer_type", "fieldtype": "Data", "width": 110},
		{"label": "Mobile No", "fieldname": "mobile_no", "fieldtype": "Data", "width": 120},
		{"label": "Email", "fieldname": "email_id", "fieldtype": "Data", "width": 170},
		{"label": "Disabled", "fieldname": "disabled", "fieldtype": "Check", "width": 80},
	]


def get_data(filters):
	# No company filter: Customer has no direct company field in ERPNext
	# (confirmed in customer.json — only the multi-company "Allowed To
	# Transact With" child table and "represents_company", which only
	# applies to internal customers), so there's no single field to scope
	# by, same limitation already noted for this doctype's sidebar entry.
	conditions = ["1=1"]
	values = {}

	if filters.get("customer_group"):
		conditions.append("customer_group = %(customer_group)s")
		values["customer_group"] = filters["customer_group"]
	if filters.get("territory"):
		conditions.append("territory = %(territory)s")
		values["territory"] = filters["territory"]
	if filters.get("customer_type"):
		conditions.append("customer_type = %(customer_type)s")
		values["customer_type"] = filters["customer_type"]
	if filters.get("disabled") not in (None, ""):
		conditions.append("disabled = %(disabled)s")
		values["disabled"] = filters["disabled"]

	where_clause = " AND ".join(conditions)

	return frappe.db.sql(
		f"""
		SELECT name, customer_name, customer_group, territory, customer_type, mobile_no, email_id, disabled
		FROM `tabCustomer`
		WHERE {where_clause}
		ORDER BY customer_name
		""",
		values,
		as_dict=1,
	)
