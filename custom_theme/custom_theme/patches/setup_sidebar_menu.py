import json

import frappe

# Each sidebar group becomes a top-level Workspace in the desk sidebar.
# Each doctype becomes a child Workspace nested under it; its page content
# is a single Shortcut, so opening it is one click away from the doctype list.
MODULES = [
	{
		"title": "HR Module",
		"icon": "hr",
		"doctypes": [
			"User",
			"Employee",
			"Employee Checkin",
			"Attendance",
			"Shift Type",
			"Leave Application",
			"Leave Allocation",
			"Leave Type",
			"Holiday List",
		],
	},
	{
		"title": "Payroll Module",
		"icon": "money-coins-1",
		"doctypes": [
			"Salary Component",
			"Salary Structure",
			"Salary Structure Assignment",
			"Bulk Salary Structure Assignment",
			"Payroll Entry",
			"Salary Slip",
		],
	},
	{
		"title": "Expense Module",
		"icon": "expenses",
		"doctypes": [
			"Expense Claim",
			"Expense Claim Type",
		],
	},
	{
		"title": "Sales Module",
		"icon": "sell",
		"doctypes": [
			"Lead",
			"Lead Source",
			"Customer",
		],
	},
	{
		"title": "Service Module",
		"icon": "support",
		"doctypes": [
			"Installation Note",
		],
	},
]


def execute():
	for module in MODULES:
		parent_name = ensure_parent_workspace(module["title"], module["icon"])
		for idx, doctype in enumerate(module["doctypes"]):
			ensure_doctype_workspace(parent_name, module["title"], doctype, idx)


def ensure_parent_workspace(title, icon):
	if frappe.db.exists("Workspace", title):
		return title

	doc = frappe.new_doc("Workspace")
	doc.label = title
	doc.title = title
	doc.public = 1
	doc.is_hidden = 0
	doc.icon = icon
	doc.parent_page = ""
	doc.sequence_id = next_sequence_id()
	doc.content = json.dumps(
		[
			{
				"id": frappe.generate_hash(length=10),
				"type": "header",
				"data": {"text": f'<span class="h4"><b>{title}</b></span>', "col": 12},
			}
		]
	)
	doc.insert(ignore_permissions=True)
	return doc.name


def ensure_doctype_workspace(parent_name, module_title, doctype, idx):
	label = f"{module_title} - {doctype}"
	if frappe.db.exists("Workspace", label):
		return

	if not frappe.db.exists("DocType", doctype):
		frappe.log_error(
			title="setup_sidebar_menu",
			message=f"Skipped sidebar entry for missing DocType: {doctype} (module: {module_title})",
		)
		return

	shortcut_id = frappe.generate_hash(length=10)

	doc = frappe.new_doc("Workspace")
	doc.label = label
	doc.title = doctype
	doc.public = 1
	doc.is_hidden = 0
	doc.parent_page = parent_name
	doc.sequence_id = idx + 1
	doc.content = json.dumps(
		[
			{
				"id": shortcut_id,
				"type": "shortcut",
				"data": {"shortcut_name": doctype, "col": 4},
			}
		]
	)
	doc.append(
		"shortcuts",
		{
			"label": doctype,
			"link_to": doctype,
			"type": "DocType",
			"doc_view": "List",
			"color": "Grey",
		},
	)
	doc.insert(ignore_permissions=True)


def next_sequence_id():
	max_seq = frappe.db.sql(
		"select max(sequence_id) from `tabWorkspace` where ifnull(parent_page, '') = ''"
	)[0][0]
	return (max_seq or 0) + 1
