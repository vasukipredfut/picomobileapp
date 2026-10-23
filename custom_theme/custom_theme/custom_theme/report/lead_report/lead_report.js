// Copyright (c) 2026, vasuki and contributors
// For license information, please see license.txt

frappe.query_reports["Lead Report"] = {
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			reqd: 1,
			// frappe.boot.custom_theme_current_company (set by
			// custom_theme.utils.set_current_company_in_boot), not
			// frappe.defaults.get_user_default("Company") — this app's own
			// source of truth for "the logged-in user's company", confirmed
			// to reflect a Company User Permission unlike the native default.
			default: frappe.boot.custom_theme_current_company,
		},
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			reqd: 1,
			default: frappe.datetime.add_months(frappe.datetime.get_today(), -12),
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			reqd: 1,
			default: frappe.datetime.get_today(),
		},
		// Status and Territory filters removed per request ("in filter
		// remove status and territory") — Status stays visible as a column,
		// just not filterable from here anymore.
	],
};
