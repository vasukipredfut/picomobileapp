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
			"Shift Type",
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
		],
	},
	{
		"title": "Service Module",
		"icon": "support",
		"doctypes": [
			"Installation Report",
		],
	},
	{
		"title": "Settings",
		"icon": "setting",
		"doctypes": [
			"Company",
			"Company Branding",
		],
	},
]


def execute():
	for module in MODULES:
		parent_name = ensure_parent_workspace(module["title"], module["icon"])
		wanted_labels = set()
		for idx, entry in enumerate(module["doctypes"]):
			doctype, _ = normalize_doctype_entry(entry)
			wanted_labels.add(f"{module['title']} - {doctype}")
			ensure_doctype_workspace(parent_name, module["title"], entry, idx)
		remove_stale_doctype_workspaces(module["title"], wanted_labels)


def remove_stale_doctype_workspaces(module_title, wanted_labels):
	# ensure_doctype_workspace() only ever upserts entries still present in
	# MODULES — it has no way to notice an entry that used to be there and
	# got deleted from this file, so a prior run's Workspace row for it would
	# otherwise dangle in the sidebar forever. Deleted outright (not just
	# is_hidden=1) because is_hidden is silently ignored for any user with
	# the Workspace Manager role (see get_workspace_sidebar_items() in
	# frappe/desk/desktop.py: "page.public and (has_access or not
	# page.is_hidden)") — an Administrator-role account has has_access=True
	# there, so it would still see an is_hidden workspace, making a "remove
	# this from the sidebar" request look unfixed to whoever tests as admin.
	# Safe to delete rather than hide: each of these child workspaces is
	# nothing but a single shortcut tile (see ensure_doctype_workspace) with
	# no content of its own, fully reconstructed from MODULES by re-running
	# this patch if a removed entry is ever wanted back.
	existing = frappe.get_all("Workspace", filters={"parent_page": module_title}, pluck="name")
	for name in existing:
		if name not in wanted_labels:
			frappe.delete_doc("Workspace", name, ignore_permissions=True, force=True)


def normalize_doctype_entry(entry):
	"""A plain string links to (and displays) that exact DocType name. A dict
	{"doctype": ..., "label": ...} links to the real DocType but shows a
	different label in the sidebar."""
	if isinstance(entry, dict):
		return entry["doctype"], entry.get("label", entry["doctype"])
	return entry, entry


def ensure_parent_workspace(title, icon):
	# Upsert: re-running this after an icon/title tweak should update the
	# existing workspace in place, not skip it.
	if frappe.db.exists("Workspace", title):
		doc = frappe.get_doc("Workspace", title)
	else:
		doc = frappe.new_doc("Workspace")
		doc.label = title
		doc.parent_page = ""
		doc.sequence_id = next_sequence_id()

	doc.title = title
	doc.public = 1
	doc.is_hidden = 0
	doc.icon = icon
	doc.content = json.dumps(
		[
			{
				"id": frappe.generate_hash(length=10),
				"type": "header",
				"data": {"text": f'<span class="h4"><b>{title}</b></span>', "col": 12},
			}
		]
	)
	doc.save(ignore_permissions=True)
	return doc.name


def ensure_doctype_workspace(parent_name, module_title, entry, idx):
	doctype, display_label = normalize_doctype_entry(entry)
	# The internal name/label stays tied to the real doctype, not the display
	# text — so changing just the display label later updates this same
	# record instead of creating an orphaned duplicate.
	internal_label = f"{module_title} - {doctype}"

	if not frappe.db.exists("DocType", doctype):
		frappe.log_error(
			title="setup_sidebar_menu",
			message=f"Skipped sidebar entry for missing DocType: {doctype} (module: {module_title})",
		)
		return

	shortcut_id = frappe.generate_hash(length=10)

	# Upsert: re-running this after a label/order tweak should update the
	# existing workspace in place, not skip it.
	if frappe.db.exists("Workspace", internal_label):
		doc = frappe.get_doc("Workspace", internal_label)
	else:
		doc = frappe.new_doc("Workspace")
		doc.label = internal_label
		doc.parent_page = parent_name

	doc.title = display_label
	doc.public = 1
	doc.is_hidden = 0
	doc.sequence_id = idx + 1
	doc.content = json.dumps(
		[
			{
				"id": shortcut_id,
				"type": "shortcut",
				"data": {"shortcut_name": display_label, "col": 4},
			}
		]
	)
	doc.shortcuts = []
	doc.append(
		"shortcuts",
		{
			"label": display_label,
			"link_to": doctype,
			"type": "DocType",
			"doc_view": "List",
			"color": "Grey",
		},
	)
	doc.save(ignore_permissions=True)


def next_sequence_id():
	max_seq = frappe.db.sql(
		"select max(sequence_id) from `tabWorkspace` where ifnull(parent_page, '') = ''"
	)[0][0]
	return (max_seq or 0) + 1
