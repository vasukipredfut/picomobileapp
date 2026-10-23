// Copyright (c) 2026, vasuki and contributors
// For license information, please see license.txt

frappe.query_reports["Employee Checkin Report"] = {
	filters: [
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			default: frappe.datetime.month_start(),
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			default: frappe.datetime.month_end(),
		},
		{
			fieldname: "employee",
			label: __("Employee"),
			fieldtype: "Link",
			options: "Employee",
		},
		{
			fieldname: "log_type",
			label: __("Log Type"),
			fieldtype: "Select",
			options: ["", "IN", "OUT"],
		},
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			// frappe.boot.custom_theme_current_company (set by
			// custom_theme.utils.set_current_company_in_boot), not
			// frappe.defaults.get_user_default("Company") — confirmed that
			// one doesn't reflect a Company User Permission, this app's own
			// source of truth for "the logged-in user's company".
			default: frappe.boot.custom_theme_current_company,
		},
	],
};
