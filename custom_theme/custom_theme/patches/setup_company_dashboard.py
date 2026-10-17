import json

import frappe

# Dynamic company filter — same pattern ERPNext's own stock Number Cards use
# (see "Annual Sales" / "Annual Purchase") so each user sees their own
# default company's numbers.
COMPANY_FILTER = 'frappe.defaults.get_user_default("Company")'

WORKSPACE_TITLE = "Company Dashboard"  # not "Dashboard" — collides with the core Dashboard DocType

NUMBER_CARDS = [
	{
		"label": "Number of Leads",
		"document_type": "Lead",
		"filters_json": [],
		"dynamic_filters_json": [["Lead", "company", "=", COMPANY_FILTER]],
		"color": "#2490EF",
	},
	{
		"label": "Number of Customers",
		"document_type": "Customer",
		"filters_json": [],
		# Customer has no simple top-level "company" field in stock ERPNext
		# (it's company-agnostic, linked via a child table), so this stays global.
		"dynamic_filters_json": [],
		"color": "#29CD42",
	},
	{
		"label": "Number of Installation Reports",
		"document_type": "Installation Note",
		"filters_json": [["Installation Note", "docstatus", "=", "1", False]],
		"dynamic_filters_json": [["Installation Note", "company", "=", COMPANY_FILTER]],
		"color": "#FF8D29",
	},
]

WELCOME_BLOCK_NAME = "Pico Dashboard Welcome Banner"

WELCOME_HTML = """
<div class="pico-welcome-banner">
	<div class="pico-welcome-title" id="pico-welcome-title">Welcome</div>
</div>
"""

WELCOME_STYLE = """
.pico-welcome-banner {
	padding: 32px 24px;
	border-radius: 8px;
	background: linear-gradient(135deg, #0b63d6 0%, #2490ef 100%);
	text-align: center;
	color: #fff;
}
.pico-welcome-title {
	font-size: 28px;
	font-weight: 700;
}
"""

WELCOME_SCRIPT = """
let company = frappe.defaults.get_user_default("Company") || frappe.defaults.get_global_default("company") || "";
let title_el = root_element.querySelector("#pico-welcome-title");
if (title_el) {
	title_el.textContent = company ? ("Welcome to " + company) : "Welcome";
}
"""


def execute():
	ensure_welcome_block()
	for card in NUMBER_CARDS:
		ensure_number_card(card)
	ensure_dashboard_workspace()


def ensure_welcome_block():
	# Upsert: re-running this after a content/style tweak should update the
	# existing block in place, not skip it.
	if frappe.db.exists("Custom HTML Block", WELCOME_BLOCK_NAME):
		doc = frappe.get_doc("Custom HTML Block", WELCOME_BLOCK_NAME)
	else:
		doc = frappe.new_doc("Custom HTML Block")
		doc.name = WELCOME_BLOCK_NAME
		doc.private = 0

	doc.html = WELCOME_HTML
	doc.style = WELCOME_STYLE
	doc.script = WELCOME_SCRIPT
	doc.save(ignore_permissions=True)


def ensure_number_card(card):
	if frappe.db.exists("Number Card", card["label"]):
		return

	if not frappe.db.exists("DocType", card["document_type"]):
		frappe.log_error(
			title="setup_company_dashboard",
			message=f"Skipped number card for missing DocType: {card['document_type']}",
		)
		return

	doc = frappe.new_doc("Number Card")
	doc.label = card["label"]
	doc.document_type = card["document_type"]
	doc.function = "Count"
	doc.type = "Document Type"
	doc.is_public = 1
	doc.color = card["color"]
	doc.filters_json = json.dumps(card["filters_json"])
	doc.dynamic_filters_json = json.dumps(card["dynamic_filters_json"])
	doc.insert(ignore_permissions=True)


def ensure_dashboard_workspace():
	if frappe.db.exists("Workspace", WORKSPACE_TITLE):
		return

	content = [
		{
			"id": frappe.generate_hash(length=10),
			"type": "custom_block",
			"data": {"custom_block_name": WELCOME_BLOCK_NAME, "col": 12},
		},
		{
			"id": frappe.generate_hash(length=10),
			"type": "spacer",
			"data": {"col": 12},
		},
	]
	for card in NUMBER_CARDS:
		if not frappe.db.exists("Number Card", card["label"]):
			continue
		content.append(
			{
				"id": frappe.generate_hash(length=10),
				"type": "number_card",
				"data": {"number_card_name": card["label"], "col": 4},
			}
		)

	doc = frappe.new_doc("Workspace")
	doc.label = WORKSPACE_TITLE
	doc.title = WORKSPACE_TITLE
	doc.public = 1
	doc.is_hidden = 0
	doc.icon = "dashboard"
	doc.parent_page = ""
	doc.sequence_id = next_sequence_id()
	doc.content = json.dumps(content)

	# The content JSON above only decides layout/order — the widgets are
	# actually resolved from these child tables at render time.
	doc.append(
		"custom_blocks",
		{"custom_block_name": WELCOME_BLOCK_NAME, "label": WELCOME_BLOCK_NAME},
	)
	for card in NUMBER_CARDS:
		if not frappe.db.exists("Number Card", card["label"]):
			continue
		doc.append(
			"number_cards",
			{"number_card_name": card["label"], "label": card["label"]},
		)

	doc.insert(ignore_permissions=True)


def next_sequence_id():
	max_seq = frappe.db.sql(
		"select max(sequence_id) from `tabWorkspace` where ifnull(parent_page, '') = ''"
	)[0][0]
	return (max_seq or 0) + 1
