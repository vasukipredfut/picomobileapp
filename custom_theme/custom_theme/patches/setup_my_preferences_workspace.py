import json

import frappe

BLOCK_NAME = "My Preferences Panel"
WORKSPACE_TITLE = "My Preferences"

# A plain frappe.ui.Page (the original implementation) never gets the desk's
# left navigation sidebar — that sidebar only exists for genuine Workspace
# routes (frappe.views.Workspace builds it; frappe.ui.Page's "sidebar" option
# is just an empty slot meant for page-specific content, confirmed by
# inspecting the live DOM: it rendered with zero children). Rebuilding this
# as a Workspace + Custom HTML Block — the exact same mechanism the Home
# Dashboard's welcome banner already uses — gives it the sidebar for free,
# at the cost of writing the UI as a flat script instead of a class (Custom
# HTML Block scripts run once against a `root_element` variable, same as the
# welcome banner's script).
STYLE = """
.my-preferences-page { max-width: 650px; margin: 0 auto; padding: 20px; }
.profile-card { text-align: center; margin-bottom: 24px; }
.profile-avatar { width: 64px; height: 64px; border-radius: 50%; background: #1976d2; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; margin: 0 auto 12px; }
.profile-name { font-weight: 700; font-size: 16px; }
.profile-role-badge { display: inline-block; background: #eef1f4; color: #1f2937; border-radius: 999px; padding: 2px 10px; font-size: 12px; margin-top: 4px; }
.profile-fields-section { margin-bottom: 24px; }
.profile-fields-title { font-weight: 700; margin-bottom: 12px; }
.profile-fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.field-group label { display: block; font-size: 12px; color: #6b7280; margin-bottom: 4px; }
.field-group input { width: 100%; padding: 6px 10px; border: 1px solid #d1d8dd; border-radius: 4px; box-sizing: border-box; }
.field-group input:disabled { background: #f5f5f5; color: #888; }
.theme-pref-section h5 { margin-bottom: 4px; }
.theme-pref-toggle { display: flex; align-items: center; gap: 10px; margin: 16px 0; }
.theme-pref-group { margin-bottom: 20px; }
.theme-pref-label { display: block; font-weight: 600; margin-bottom: 8px; }
.theme-swatch-row { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.theme-swatch { width: 28px; height: 28px; border-radius: 50%; display: inline-block; cursor: pointer; border: 2px solid transparent; }
.theme-swatch.selected { border-color: #1f2937; box-shadow: 0 0 0 2px #fff inset; }
.theme-hex-input { width: 120px; padding: 4px 8px; border: 1px solid #d1d8dd; border-radius: 4px; }
.theme-btn-group { display: flex; gap: 8px; }
.theme-option-btn.active { background: #1976d2; color: #fff; border-color: transparent; }
.theme-preview-row { display: flex; gap: 10px; }
.theme-preview-btn { padding: 6px 20px; border: none; }
.theme-pref-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; border-top: 1px solid #d1d8dd; padding-top: 16px; }
.mp-save-profile-btn { margin-top: 8px; }
"""

SCRIPT = """
(function () {
	var COLORS = ["#1976d2","#283593","#2e7d32","#43a047","#f9a825","#e53935","#c2185b","#8e24aa","#5e35b1","#00897b","#616161"];
	var DEFAULTS = {app_color:"#1976d2",primary_color:"#1976d2",secondary_color:"#1976d2",button_style:"Pill",font_size:"Medium",light_mode:1};
	var state = Object.assign({}, DEFAULTS);
	var profile = {full_name:"", email:"", phone:"", username:"", role:""};
	// root_element IS the Shadow Root, and Frappe also places the block's
	// <style>/<link> tags directly inside it as SIBLINGS of our "html" field
	// content — not nested inside it. render() targets this specific inner
	// container (the "html" field's own <div id="mp-root">) instead of
	// root_element itself, so re-rendering never wipes those sibling tags.
	var mount = root_element.querySelector("#mp-root");

	function colorSwatches(field, selected) {
		return COLORS.map(function (c) {
			return '<span class="theme-swatch ' + (c === selected ? "selected" : "") +
				'" data-field="' + field + '" data-color="' + c + '" style="background:' + c + '"></span>';
		}).join("");
	}

	function radius() {
		return {Pill: "999px", Rounded: "6px", Square: "0px"}[state.button_style];
	}

	function render() {
		// NOT root_element.innerHTML = ... — that would also wipe the
		// sibling <style>/<link> tags Frappe placed directly in the Shadow
		// Root (confirmed live: this exact bug silently stripped all CSS on
		// the very first render). mount (#mp-root, our own "html" field
		// content) is the only safe assignment target.
		// NOT $(mount).html(...) either — jQuery's .html() setter only acts
		// on nodeType===1 (Element) nodes; mount here genuinely is nodeType
		// 1 so that part would actually be fine, but staying consistent
		// with plain DOM methods throughout this script avoids relearning
		// this the hard way a third time.
		mount.innerHTML =
			'<div class="my-preferences-page">' +
				'<div class="profile-card">' +
					'<div class="profile-avatar">' + frappe.utils.escape_html((profile.full_name || "U").charAt(0).toUpperCase()) + '</div>' +
					'<div class="profile-name">' + frappe.utils.escape_html(profile.full_name || "") + '</div>' +
					'<div class="profile-role-badge">' + frappe.utils.escape_html(profile.role || "") + '</div>' +
				'</div>' +
				'<div class="profile-fields-section">' +
					'<div class="profile-fields-title">' + __("Profile Information") + '</div>' +
					'<div class="profile-fields-grid">' +
						'<div class="field-group"><label>' + __("Full Name") + '</label><input type="text" class="mp-full-name" value="' + frappe.utils.escape_html(profile.full_name || "") + '"></div>' +
						'<div class="field-group"><label>' + __("Username") + '</label><input type="text" value="' + frappe.utils.escape_html(profile.username || "") + '" disabled></div>' +
						'<div class="field-group"><label>' + __("Email") + '</label><input type="text" value="' + frappe.utils.escape_html(profile.email || "") + '" disabled></div>' +
						'<div class="field-group"><label>' + __("Phone") + '</label><input type="text" class="mp-phone" value="' + frappe.utils.escape_html(profile.phone || "") + '"></div>' +
						'<div class="field-group"><label>' + __("Role") + '</label><input type="text" value="' + frappe.utils.escape_html(profile.role || "") + '" disabled></div>' +
					'</div>' +
					'<button type="button" class="btn btn-primary btn-sm mp-save-profile-btn">' + __("Save Profile") + '</button>' +
				'</div>' +
				'<hr>' +
				'<div class="theme-pref-section">' +
					'<h5>' + __("User Preferences") + '</h5>' +
					'<p class="text-muted">' + __("App Color changes the desk navbar and sidebar icon color. Font Size affects the navbar and this page.") + '</p>' +
					'<div class="theme-pref-toggle"><label class="theme-pref-label">' + __("Light Mode") + '</label><input type="checkbox" class="theme-light-mode" ' + (state.light_mode ? "checked" : "") + '></div>' +
					'<div class="theme-pref-group"><label class="theme-pref-label">' + __("App Color (navbar + sidebar icons)") + '</label>' +
						'<div class="theme-swatch-row" data-field="app_color">' + colorSwatches("app_color", state.app_color) + '</div>' +
						'<input type="text" class="theme-hex-input" data-field="app_color" value="' + state.app_color + '"></div>' +
					'<div class="theme-pref-group"><label class="theme-pref-label">' + __("Primary Color") + '</label>' +
						'<div class="theme-swatch-row" data-field="primary_color">' + colorSwatches("primary_color", state.primary_color) + '</div>' +
						'<input type="text" class="theme-hex-input" data-field="primary_color" value="' + state.primary_color + '"></div>' +
					'<div class="theme-pref-group"><label class="theme-pref-label">' + __("Secondary Color") + '</label>' +
						'<div class="theme-swatch-row" data-field="secondary_color">' + colorSwatches("secondary_color", state.secondary_color) + '</div>' +
						'<input type="text" class="theme-hex-input" data-field="secondary_color" value="' + state.secondary_color + '"></div>' +
					'<div class="theme-pref-group"><label class="theme-pref-label">' + __("Button Style") + '</label><div class="theme-btn-group" data-field="button_style">' +
						["Pill", "Rounded", "Square"].map(function (o) {
							return '<button type="button" class="btn btn-default theme-option-btn ' + (state.button_style === o ? "active" : "") + '" data-value="' + o + '">' + __(o) + '</button>';
						}).join("") +
					'</div></div>' +
					'<div class="theme-pref-group"><label class="theme-pref-label">' + __("Font Size") + '</label><div class="theme-btn-group" data-field="font_size">' +
						["Small", "Medium", "Large"].map(function (o) {
							return '<button type="button" class="btn btn-default theme-option-btn ' + (state.font_size === o ? "active" : "") + '" data-value="' + o + '">' + __(o) + '</button>';
						}).join("") +
					'</div></div>' +
					'<div class="theme-pref-group"><label class="theme-pref-label">' + __("Preview") + '</label><div class="theme-preview-row">' +
						'<button type="button" class="btn theme-preview-btn" style="background:' + state.primary_color + ';color:#fff;border-radius:' + radius() + '">' + __("Primary") + '</button>' +
						'<button type="button" class="btn theme-preview-btn" style="background:' + state.secondary_color + ';color:#fff;border-radius:' + radius() + '">' + __("Secondary") + '</button>' +
						'<button type="button" class="btn theme-preview-btn" style="background:transparent;color:' + state.primary_color + ';border:1px solid ' + state.primary_color + ';border-radius:' + radius() + '">' + __("Outlined") + '</button>' +
					'</div></div>' +
					'<div class="theme-pref-actions">' +
						'<button type="button" class="btn btn-default theme-reset-btn">' + __("Reset to Defaults") + '</button>' +
						'<button type="button" class="btn btn-primary theme-save-btn">' + __("Save Preferences") + '</button>' +
					'</div>' +
				'</div>' +
			'</div>';
		bindEvents();
	}

	function colorWelcomeBanner(color) {
		var containers = document.querySelectorAll('[custom_block_name="Pico Dashboard Welcome Banner"]');
		containers.forEach(function (container) {
			var host = container.querySelector(".widget-body > *");
			var banner = host && host.shadowRoot && host.shadowRoot.querySelector(".pico-welcome-banner");
			if (banner) banner.style.setProperty("background", color, "important");
		});
	}

	function applyLive() {
		var style = document.getElementById("custom-theme-preference-style");
		if (!style) {
			style = document.createElement("style");
			style.id = "custom-theme-preference-style";
			document.head.appendChild(style);
		}
		style.textContent =
			".navbar, .page-head.flex { background: " + state.app_color + " !important; }" +
			".sidebar-item-icon .icon-md, .sidebar-item-icon .icon-md use { fill: " + state.app_color + " !important; stroke: " + state.app_color + " !important; }";
		colorWelcomeBanner(state.app_color);
		document.body.classList.remove("theme-font-small", "theme-font-medium", "theme-font-large");
		document.body.classList.add("theme-font-" + state.font_size.toLowerCase());
	}

	function on(selector, event, handler) {
		// root_element.querySelectorAll(...) instead of $(root_element).find(...)
		// — same ShadowRoot issue as render(): jQuery's traversal starting
		// from a ShadowRoot context is not reliable the way it is from a
		// normal Element, so this stays on native DOM methods throughout.
		// Each individual matched element below (a real <span>/<input>/
		// <button>, nodeType 1) is still wrapped in $() freely — only the
		// ShadowRoot itself needs to be avoided.
		root_element.querySelectorAll(selector).forEach(function (el) {
			el.addEventListener(event, handler);
		});
	}

	function bindEvents() {
		on(".theme-swatch", "click", function () {
			var $el = $(this);
			state[$el.data("field")] = $el.data("color");
			render();
			applyLive();
		});
		on(".theme-hex-input", "change", function () {
			var $el = $(this);
			state[$el.data("field")] = $el.val();
			render();
			applyLive();
		});
		on(".theme-btn-group .theme-option-btn", "click", function () {
			var $el = $(this);
			var field = $el.closest(".theme-btn-group").data("field");
			state[field] = $el.data("value");
			render();
			applyLive();
		});
		on(".theme-light-mode", "change", function (e) {
			state.light_mode = e.target.checked ? 1 : 0;
		});
		on(".theme-reset-btn", "click", function () {
			state = Object.assign({}, DEFAULTS);
			render();
			applyLive();
		});
		on(".theme-save-btn", "click", function () {
			frappe.call({
				method: "custom_theme.custom_theme.doctype.theme_preference.theme_preference.save_my_preferences",
				args: state,
				freeze: true,
				callback: function () {
					frappe.boot.custom_theme_preference = Object.assign({}, state);
					frappe.show_alert({message: __("Preferences saved"), indicator: "green"});
				},
			});
		});
		on(".mp-save-profile-btn", "click", function () {
			frappe.call({
				method: "custom_theme.custom_theme.doctype.theme_preference.theme_preference.save_my_profile",
				args: {
					full_name: root_element.querySelector(".mp-full-name").value,
					phone: root_element.querySelector(".mp-phone").value,
				},
				freeze: true,
				callback: function (r) {
					Object.assign(profile, r.message);
					render();
					frappe.show_alert({message: __("Profile saved"), indicator: "green"});
				},
			});
		});
	}

	frappe.call("custom_theme.custom_theme.doctype.theme_preference.theme_preference.get_my_profile").then(function (r) {
		if (r.message) Object.assign(profile, r.message);
		render();
	});
	frappe.call("custom_theme.custom_theme.doctype.theme_preference.theme_preference.get_my_preferences").then(function (r) {
		if (r.message && Object.keys(r.message).length) {
			Object.assign(state, r.message);
			render();
			applyLive();
		}
	});
})();
"""


def execute():
	# frappe.desk.utils.validate_route_conflict (run on every Workspace save)
	# skips its check entirely when this flag is set — bench migrate sets it
	# automatically, but bench console does not, so re-running this patch via
	# console (needed any time it's edited, since it's no longer a fresh
	# patch) would otherwise throw "Name already taken" the moment the old
	# Page record hasn't been removed yet. Set defensively regardless of
	# call order, not just by reordering below.
	frappe.flags.in_migrate = True

	# Must run before ensure_workspace(): on a bench where this patch has
	# never succeeded before, the old Page: my-preferences record is still
	# there, and the new Workspace's save would collide with it on the same
	# route slug otherwise (confirmed live: this exact NameError on a fresh
	# server run).
	remove_old_page()
	ensure_custom_html_block()
	ensure_workspace()


def ensure_custom_html_block():
	if frappe.db.exists("Custom HTML Block", BLOCK_NAME):
		doc = frappe.get_doc("Custom HTML Block", BLOCK_NAME)
	else:
		doc = frappe.new_doc("Custom HTML Block")
		doc.name = BLOCK_NAME

	doc.html = '<div id="mp-root"></div>'
	doc.style = STYLE
	doc.script = SCRIPT
	doc.save(ignore_permissions=True)


def ensure_workspace():
	content = json.dumps(
		[{"id": "mpprefblk01", "type": "custom_block", "data": {"custom_block_name": BLOCK_NAME, "col": 12}}]
	)

	if frappe.db.exists("Workspace", WORKSPACE_TITLE):
		doc = frappe.get_doc("Workspace", WORKSPACE_TITLE)
	else:
		doc = frappe.new_doc("Workspace")
		doc.label = WORKSPACE_TITLE
		doc.parent_page = ""
		doc.sequence_id = next_sequence_id()

	doc.title = WORKSPACE_TITLE
	doc.public = 1
	# NOT is_hidden = 1 — confirmed live this breaks more than just sidebar
	# cosmetics: frappe/desk/desktop.py's get_workspace_sidebar_items() (the
	# function that both builds the sidebar tree AND supplies the
	# this.public_pages list workspace.js's show_page() uses to look up a
	# workspace's content by name) excludes is_hidden workspaces for any
	# user without the "Workspace Manager" role. That makes the workspace
	# not just invisible but genuinely unreachable by direct navigation too
	# — confirmed: a non-Workspace-Manager user hitting /app/my-preferences
	# got Frappe's generic "Page not found" even though the record existed,
	# while Administrator (who bypasses all permission checks) worked fine.
	doc.is_hidden = 0
	doc.icon = "setting"
	doc.content = content
	# The "content" JSON above is only *layout* (what goes where) — the
	# actual widget reference has to also be registered in this child table,
	# the same way Number Card/Custom HTML Block widgets are elsewhere in
	# this file, or the block renders as empty (confirmed: without this, the
	# workspace loaded with a blank "codex-editor--empty" content area).
	doc.custom_blocks = []
	doc.append("custom_blocks", {"custom_block_name": BLOCK_NAME, "label": BLOCK_NAME})
	doc.save(ignore_permissions=True)


def remove_old_page():
	"""The original implementation (frappe.ui.Page, see my_preferences.js) is
	superseded by the Workspace above, which shares the exact same route
	slug ("my-preferences") — leaving both registered risks route ambiguity."""
	if frappe.db.exists("Page", "my-preferences"):
		frappe.delete_doc("Page", "my-preferences", ignore_permissions=True, force=True)


def next_sequence_id():
	max_seq = frappe.db.sql(
		"select max(sequence_id) from `tabWorkspace` where ifnull(parent_page, '') = ''"
	)[0][0]
	return (max_seq or 0) + 1
