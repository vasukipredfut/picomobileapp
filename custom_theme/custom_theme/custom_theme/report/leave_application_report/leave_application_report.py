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
		{"label": "Leave Type", "fieldname": "leave_type", "fieldtype": "Link", "options": "Leave Type", "width": 120},
		{"label": "From Date", "fieldname": "from_date", "fieldtype": "Date", "width": 100},
		{"label": "To Date", "fieldname": "to_date", "fieldtype": "Date", "width": 100},
		{"label": "Total Leave Days", "fieldname": "total_leave_days", "fieldtype": "Float", "width": 120},
		{"label": "Status", "fieldname": "status", "fieldtype": "Data", "width": 100},
		{"label": "Department", "fieldname": "department", "fieldtype": "Link", "options": "Department", "width": 150},
		{"label": "Company", "fieldname": "company", "fieldtype": "Link", "options": "Company", "width": 140},
	]


def get_data(filters):
	conditions = ["1=1"]
	values = {}

	# From/To Date filter on overlap with the leave period, not an exact
	# match — a leave spanning multiple days should show up for any date
	# range it touches, same convention as attendance/payroll date filters
	# elsewhere in this app.
	if filters.get("from_date"):
		conditions.append("la.to_date >= %(from_date)s")
		values["from_date"] = filters["from_date"]
	if filters.get("to_date"):
		conditions.append("la.from_date <= %(to_date)s")
		values["to_date"] = filters["to_date"]
	if filters.get("employee"):
		conditions.append("la.employee = %(employee)s")
		values["employee"] = filters["employee"]
	if filters.get("leave_type"):
		conditions.append("la.leave_type = %(leave_type)s")
		values["leave_type"] = filters["leave_type"]
	if filters.get("company"):
		conditions.append("la.company = %(company)s")
		values["company"] = filters["company"]
	if filters.get("status"):
		conditions.append("la.status = %(status)s")
		values["status"] = filters["status"]
	if filters.get("department"):
		conditions.append("la.department = %(department)s")
		values["department"] = filters["department"]

	where_clause = " AND ".join(conditions)

	return frappe.db.sql(
		f"""
		SELECT
			la.employee, la.employee_name, la.leave_type, la.from_date, la.to_date,
			la.total_leave_days, la.status, la.department, la.company
		FROM `tabLeave Application` la
		WHERE {where_clause}
		ORDER BY la.from_date DESC
		""",
		values,
		as_dict=1,
	)
