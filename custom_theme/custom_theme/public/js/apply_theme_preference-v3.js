// Loaded on every desk page via app_include_js. Applies a user's saved
// Theme Preference (embedded into frappe.boot by utils.set_theme_preference_in_boot)
// the same way my_preferences.js applies it live before Save — so the choice
// sticks across page loads and new sessions, not just while on that page.
//
// App Color covers three separate elements that all used to carry their own
// independent hardcoded color, which is why they visibly disagreed with each
// other before this: the navbar itself, .page-head.flex (the page-title bar
// directly under the navbar — giving it the SAME color as the navbar is what
// makes the two read as one continuous bar instead of two stacked layers),
// and .pico-welcome-banner (the Home Dashboard's welcome banner, which has
// its own gradient set via a Custom HTML Block's "style" field in the DB,
// entirely unrelated to any CSS file).
//
// app_include_js scripts can execute before frappe's own core bundle has
// defined `frappe.ready` (script order isn't guaranteed), so this polls for
// `frappe.boot` instead of calling frappe.ready() directly.
(function () {
	function apply() {
		const pref = frappe.boot && frappe.boot.custom_theme_preference;
		if (!pref) return;

		if (pref.app_color) {
			let style = document.getElementById("custom-theme-preference-style");
			if (!style) {
				style = document.createElement("style");
				style.id = "custom-theme-preference-style";
				document.head.appendChild(style);
			}
			style.textContent = `
				.navbar,
				.page-head.flex {
					background: ${pref.app_color} !important;
				}
				.sidebar-item-icon .icon-md,
				.sidebar-item-icon .icon-md use {
					fill: ${pref.app_color} !important;
					stroke: ${pref.app_color} !important;
				}
				.pico-welcome-banner {
					background: ${pref.app_color} !important;
				}
			`;
		}

		if (pref.font_size) {
			document.body.classList.remove("theme-font-small", "theme-font-medium", "theme-font-large");
			document.body.classList.add("theme-font-" + pref.font_size.toLowerCase());
		}
	}

	let tries = 0;
	const iv = setInterval(function () {
		tries += 1;
		if (window.frappe && frappe.boot) {
			clearInterval(iv);
			apply();
		} else if (tries > 100) {
			clearInterval(iv); // ~10s — give up rather than poll forever
		}
	}, 100);
})();
