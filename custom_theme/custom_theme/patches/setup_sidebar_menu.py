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
		"reports": [
			# Each entry links to an EXISTING Report by name (Script/Query
			# Report with its own filters + computed columns — not a Report
			# Builder/saved-list-view, which looks too similar to the plain
			# doctype list it's replacing). "Employee Checkin Report",
			# "Leave Application Report" are custom_theme's own
			# (custom_theme/custom_theme/report/...); "Shift Attendance" and
			# "Employee Leave Balance" are hrms's own built-in reports,
			# reused as-is rather than duplicating their logic.
			#
			# label is "<Doctype> Report", not the bare doctype name: this
			# Workspace's title IS that label (see ensure_report_workspace),
			# and Workspace.validate()'s validate_route_conflict rejects
			# inserting a brand-new Workspace whose title slug matches ANY
			# existing DocType name — confirmed on pico.com's Frappe version,
			# which (unlike this bench's) checks DocType names unconditionally
			# with no self-doctype exemption, so even a workspace meant to
			# represent "Attendance" can't be titled bare "Attendance" on
			# first insert there. Sidestepped by using a title that's never
			# going to collide with a real doctype name, instead of fighting
			# that framework-level check.
			{"report_name": "Employee Checkin Report", "label": "Employee Checkin Report"},
			{"report_name": "Shift Attendance", "label": "Attendance Report"},
			{"report_name": "Leave Application Report", "label": "Leave Application Report"},
			{"report_name": "Employee Leave Balance", "label": "Leave Balance"},
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
			"Lead Source",
		],
		"reports": [
			# See the comment on HR Module's "reports" above for why these are
			# titled "<Doctype> Report" rather than the bare doctype name.
			# "Customer Report" is custom_theme's own
			# (custom_theme/custom_theme/report/...); "Lead Details" is
			# erpnext's own built-in report, reused as-is.
			{"report_name": "Customer Report", "label": "Customer Report"},
			{"report_name": "Lead Details", "label": "Lead Report"},
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
		report_entries = module.get("reports", [])

		# Computed up front and cleaned up BEFORE any ensure_*_workspace() call
		# below — not after, as this used to do. A report entry can reuse the
		# exact display title of a doctype entry it's replacing (e.g. Lead's
		# plain list link replaced by a Lead report, both titled "Lead"), and
		# Workspace.validate() rejects creating a new workspace whose title
		# collides with an EXISTING workspace's route (validate_route_conflict)
		# regardless of internal name. Running cleanup only at the end meant
		# a site that had never run the reports-less version of this patch in
		# between (confirmed live on a production site that jumped straight
		# from the old MODULES list to this one) would still have the OLD
		# "HR Module - Attendance" (title "Attendance") sitting there when
		# ensure_report_workspace() tried to insert a NEW workspace also
		# titled "Attendance" for the report — a route conflict, NameError,
		# raised before cleanup ever ran.
		wanted_labels = set()
		for entry in module["doctypes"]:
			doctype, _ = normalize_doctype_entry(entry)
			wanted_labels.add(f"{module['title']} - {doctype}")
		for entry in report_entries:
			wanted_labels.add(f"{module['title']} - {entry['report_name']} Report")
		remove_stale_doctype_workspaces(module["title"], wanted_labels)

		for idx, entry in enumerate(module["doctypes"]):
			ensure_doctype_workspace(parent_name, module["title"], entry, idx)

		doctype_count = len(module["doctypes"])
		for idx, entry in enumerate(report_entries):
			ensure_report_workspace(parent_name, module["title"], entry, doctype_count + idx)


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


def ensure_report_workspace(parent_name, module_title, entry, idx):
	"""Sidebar counterpart to ensure_doctype_workspace() above, but for a
	Report instead of a plain DocType list. entry is {"report_name": ...,
	"label": ...}, linking to an ALREADY-EXISTING Report — either one of
	custom_theme's own (custom_theme/custom_theme/report/...) or a built-in
	one from erpnext/hrms (e.g. "Shift Attendance", "Lead Details",
	"Employee Leave Balance") — reused as-is rather than duplicating its
	query/column logic. Never creates a Report Builder (= a saved list view)
	here: that looked too similar to the plain doctype list it was meant to
	replace, so every entry now points to a real Script/Query Report with
	its own purpose-built filters and computed columns.

	Frappe's own sidebar tree can only link a child item to a bare
	/app/<slug> route (workspace.js's sidebar_item_container() builds
	href="/app/${frappe.router.slug(item.title)}", ignoring the shortcut's
	own type/link_to entirely) — that only happens to work for DocType
	entries because their title IS the doctype's own route slug. A named
	Report has no such single-segment route, so the actual click-to-report
	navigation is handled by apply_theme_preference.js's own click
	interceptor (matched by this workspace's parent module + display
	label), not by this href. This Workspace + Shortcut record still needs
	to exist regardless: it's what makes the item appear at all in
	frappe.boot.allowed_workspaces, which both the real sidebar clone and
	our fallback tree render from."""
	report_name = entry["report_name"]
	display_label = entry["label"]

	if not frappe.db.exists("Report", report_name):
		frappe.log_error(
			title="setup_sidebar_menu",
			message=f"Skipped report sidebar entry for missing Report: {report_name} (module: {module_title})",
		)
		return

	# " Report" suffix keeps this distinct from ensure_doctype_workspace()'s
	# "{module_title} - {doctype}" naming, so a doctype entry and a report
	# entry for the same underlying doctype (as happened with Lead, replaced
	# by its report here) can never collide on the same Workspace name.
	internal_label = f"{module_title} - {report_name} Report"

	shortcut_id = frappe.generate_hash(length=10)

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
			"link_to": report_name,
			"type": "Report",
			"color": "Grey",
		},
	)
	doc.save(ignore_permissions=True)


def next_sequence_id():
	max_seq = frappe.db.sql(
		"select max(sequence_id) from `tabWorkspace` where ifnull(parent_page, '') = ''"
	)[0][0]
	return (max_seq or 0) + 1
