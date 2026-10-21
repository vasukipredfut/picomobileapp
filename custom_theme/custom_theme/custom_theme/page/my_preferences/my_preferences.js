frappe.pages["my-preferences"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "My Preferences",
		single_column: false, // single_column:true hides the desk sidebar — was wrong, this page should look like every other desk page
	});

	new custom_theme.MyPreferences(page);
};

frappe.provide("custom_theme");

custom_theme.MyPreferences = class MyPreferences {
	// Applies live (before Save) so clicking a swatch is felt immediately, and
	// again on every page's boot (see public/js/apply_theme_preference.js) so
	// the choice persists across page loads once saved.
	static COLORS = [
		"#1976d2",
		"#283593",
		"#2e7d32",
		"#43a047",
		"#f9a825",
		"#e53935",
		"#c2185b",
		"#8e24aa",
		"#5e35b1",
		"#00897b",
		"#616161",
	];
	static DEFAULTS = {
		app_color: "#1976d2",
		primary_color: "#1976d2",
		secondary_color: "#1976d2",
		button_style: "Pill",
		font_size: "Medium",
		light_mode: 1,
	};

	constructor(page) {
		this.page = page;
		this.state = { ...MyPreferences.DEFAULTS };
		this.$body = $('<div class="my-preferences-page">').appendTo(this.page.body);
		this.render();
		this.load();
	}

	load() {
		frappe
			.call(
				"custom_theme.custom_theme.doctype.theme_preference.theme_preference.get_my_preferences"
			)
			.then((r) => {
				if (r.message && Object.keys(r.message).length) {
					Object.assign(this.state, r.message);
					this.render();
					this.apply_live();
				}
			});
	}

	save() {
		frappe.call({
			method:
				"custom_theme.custom_theme.doctype.theme_preference.theme_preference.save_my_preferences",
			args: this.state,
			freeze: true,
			callback: () => {
				frappe.boot.custom_theme_preference = { ...this.state };
				frappe.show_alert({ message: __("Preferences saved"), indicator: "green" });
			},
		});
	}

	reset() {
		this.state = { ...MyPreferences.DEFAULTS };
		this.render();
		this.apply_live();
	}

	color_welcome_banner(color) {
		// The welcome banner renders inside an OPEN SHADOW ROOT (Custom HTML
		// Block "Pico Dashboard Welcome Banner"), which page-level CSS cannot
		// reach at all regardless of specificity/!important — has to be set
		// directly on the element inside the shadow root via JS. Won't be
		// present on this page itself, but kept consistent with
		// apply_theme_preference-v3.js in case this is ever reused elsewhere.
		const containers = document.querySelectorAll(
			'[custom_block_name="Pico Dashboard Welcome Banner"]'
		);
		containers.forEach((container) => {
			const host = container.querySelector(".widget-body > *");
			const banner = host && host.shadowRoot && host.shadowRoot.querySelector(".pico-welcome-banner");
			if (banner) {
				banner.style.setProperty("background", color, "important");
			}
		});
	}

	apply_live() {
		// Same CSS this writes on every page load (apply_theme_preference.js) —
		// duplicated here deliberately so a swatch click is felt instantly,
		// before Save is even clicked.
		let style = document.getElementById("custom-theme-preference-style");
		if (!style) {
			style = document.createElement("style");
			style.id = "custom-theme-preference-style";
			document.head.appendChild(style);
		}
		style.textContent = `
			.navbar,
			.page-head.flex {
				background: ${this.state.app_color} !important;
			}
			.sidebar-item-icon .icon-md,
			.sidebar-item-icon .icon-md use {
				fill: ${this.state.app_color} !important;
				stroke: ${this.state.app_color} !important;
			}
		`;
		this.color_welcome_banner(this.state.app_color);

		document.body.classList.remove("theme-font-small", "theme-font-medium", "theme-font-large");
		document.body.classList.add("theme-font-" + this.state.font_size.toLowerCase());
	}

	color_swatches(field, selected) {
		return MyPreferences.COLORS.map(
			(c) => `
			<span class="theme-swatch ${c === selected ? "selected" : ""}"
				data-field="${field}" data-color="${c}"
				style="background:${c}"></span>
		`
		).join("");
	}

	render() {
		const s = this.state;
		this.$body.html(`
			<div class="theme-pref-section">
				<h5>${__("User Preferences")}</h5>
				<p class="text-muted">${__(
					"App Color changes the desk navbar and sidebar icon color. Font Size affects the navbar and this page."
				)}</p>

				<div class="theme-pref-toggle">
					<label class="theme-pref-label">${__("Light Mode")}</label>
					<input type="checkbox" class="theme-light-mode" ${s.light_mode ? "checked" : ""}>
				</div>

				<div class="theme-pref-group">
					<label class="theme-pref-label">${__("App Color (navbar + sidebar icons)")}</label>
					<div class="theme-swatch-row" data-field="app_color">
						${this.color_swatches("app_color", s.app_color)}
					</div>
					<input type="text" class="theme-hex-input" data-field="app_color" value="${s.app_color}">
				</div>

				<div class="theme-pref-group">
					<label class="theme-pref-label">${__("Primary Color")}</label>
					<div class="theme-swatch-row" data-field="primary_color">
						${this.color_swatches("primary_color", s.primary_color)}
					</div>
					<input type="text" class="theme-hex-input" data-field="primary_color" value="${s.primary_color}">
				</div>

				<div class="theme-pref-group">
					<label class="theme-pref-label">${__("Secondary Color")}</label>
					<div class="theme-swatch-row" data-field="secondary_color">
						${this.color_swatches("secondary_color", s.secondary_color)}
					</div>
					<input type="text" class="theme-hex-input" data-field="secondary_color" value="${s.secondary_color}">
				</div>

				<div class="theme-pref-group">
					<label class="theme-pref-label">${__("Button Style")}</label>
					<div class="theme-btn-group" data-field="button_style">
						${["Pill", "Rounded", "Square"]
							.map(
								(opt) =>
									`<button type="button" class="btn btn-default theme-option-btn ${
										s.button_style === opt ? "active" : ""
									}" data-value="${opt}">${__(opt)}</button>`
							)
							.join("")}
					</div>
				</div>

				<div class="theme-pref-group">
					<label class="theme-pref-label">${__("Font Size")}</label>
					<div class="theme-btn-group" data-field="font_size">
						${["Small", "Medium", "Large"]
							.map(
								(opt) =>
									`<button type="button" class="btn btn-default theme-option-btn ${
										s.font_size === opt ? "active" : ""
									}" data-value="${opt}">${__(opt)}</button>`
							)
							.join("")}
					</div>
				</div>

				<div class="theme-pref-group">
					<label class="theme-pref-label">${__("Preview")}</label>
					<div class="theme-preview-row">
						<button type="button" class="btn theme-preview-btn" style="background:${
							s.primary_color
						};color:#fff;border-radius:${this.radius()}">${__("Primary")}</button>
						<button type="button" class="btn theme-preview-btn" style="background:${
							s.secondary_color
						};color:#fff;border-radius:${this.radius()}">${__("Secondary")}</button>
						<button type="button" class="btn theme-preview-btn" style="background:transparent;color:${
							s.primary_color
						};border:1px solid ${s.primary_color};border-radius:${this.radius()}">${__(
			"Outlined"
		)}</button>
					</div>
				</div>

				<div class="theme-pref-actions">
					<button type="button" class="btn btn-default theme-reset-btn">${__("Reset to Defaults")}</button>
					<button type="button" class="btn btn-primary theme-save-btn">${__("Save Preferences")}</button>
				</div>
			</div>
		`);

		this.bind_events();
	}

	radius() {
		return { Pill: "999px", Rounded: "6px", Square: "0px" }[this.state.button_style];
	}

	bind_events() {
		this.$body.find(".theme-swatch").on("click", (e) => {
			const $el = $(e.currentTarget);
			this.state[$el.data("field")] = $el.data("color");
			this.render();
			this.apply_live();
		});

		this.$body.find(".theme-hex-input").on("change", (e) => {
			const $el = $(e.currentTarget);
			this.state[$el.data("field")] = $el.val();
			this.render();
			this.apply_live();
		});

		this.$body.find(".theme-btn-group .theme-option-btn").on("click", (e) => {
			const $el = $(e.currentTarget);
			const field = $el.closest(".theme-btn-group").data("field");
			this.state[field] = $el.data("value");
			this.render();
			this.apply_live();
		});

		this.$body.find(".theme-light-mode").on("change", (e) => {
			this.state.light_mode = e.currentTarget.checked ? 1 : 0;
		});

		this.$body.find(".theme-reset-btn").on("click", () => this.reset());
		this.$body.find(".theme-save-btn").on("click", () => this.save());
	}
};
