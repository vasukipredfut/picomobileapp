// Copyright (c) 2026, vasuki and contributors
// For license information, please see license.txt

frappe.query_reports["Customer Report"] = {
	filters: [
		{
			fieldname: "customer_group",
			label: __("Customer Group"),
			fieldtype: "Link",
			options: "Customer Group",
		},
		{
			fieldname: "territory",
			label: __("Territory"),
			fieldtype: "Link",
			options: "Territory",
		},
		{
			fieldname: "customer_type",
			label: __("Customer Type"),
			fieldtype: "Select",
			options: ["", "Company", "Individual", "Partnership"],
		},
		{
			fieldname: "disabled",
			label: __("Disabled"),
			fieldtype: "Check",
		},
	],
};
