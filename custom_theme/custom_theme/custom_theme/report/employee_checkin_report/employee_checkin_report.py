import frappe


def execute(filters=None):
	filters = filters or {}
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_columns():
	return [
		{"label": "Employee", "fieldname": "employee", "fieldtype": "Link", "options": "Employee", "width": 120},
		{"label": "Employee Name", "fieldname": "employee_name", "fieldtype": "Data", "width": 160},
		{"label": "Log Type", "fieldname": "log_type", "fieldtype": "Data", "width": 90},
		{"label": "Time", "fieldname": "time", "fieldtype": "Datetime", "width": 160},
		{"label": "Shift", "fieldname": "shift", "fieldtype": "Link", "options": "Shift Type", "width": 120},
		{"label": "Device ID", "fieldname": "device_id", "fieldtype": "Data", "width": 120},
		# Employee Checkin has no company field of its own — joined in from
		# the linked Employee so this report can still be filtered/scoped by
		# company, same as every other report here.
		{"label": "Company", "fieldname": "company", "fieldtype": "Link", "options": "Company", "width": 140},
	]


def get_data(filters):
	conditions = ["1=1"]
	values = {}

	if filters.get("from_date"):
		conditions.append("DATE(ec.time) >= %(from_date)s")
		values["from_date"] = filters["from_date"]
	if filters.get("to_date"):
		conditions.append("DATE(ec.time) <= %(to_date)s")
		values["to_date"] = filters["to_date"]
	if filters.get("employee"):
		conditions.append("ec.employee = %(employee)s")
		values["employee"] = filters["employee"]
	if filters.get("log_type"):
		conditions.append("ec.log_type = %(log_type)s")
		values["log_type"] = filters["log_type"]
	if filters.get("company"):
		conditions.append("e.company = %(company)s")
		values["company"] = filters["company"]

	where_clause = " AND ".join(conditions)

	return frappe.db.sql(
		f"""
		SELECT
			ec.employee, ec.employee_name, ec.log_type, ec.time, ec.shift, ec.device_id, e.company
		FROM `tabEmployee Checkin` ec
		LEFT JOIN `tabEmployee` e ON e.name = ec.employee
		WHERE {where_clause}
		ORDER BY ec.time DESC
		""",
		values,
		as_dict=1,
	)
