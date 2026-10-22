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
// and .pico-welcome-banner (the Home Dashboard's welcome banner). The banner
// is a special case: its markup+style come from a Custom HTML Block's "html"
// and "style" DB fields, and Frappe renders that block inside an OPEN SHADOW
// ROOT — confirmed by inspecting it live (customEl.shadowRoot.mode ===
// "open"). Shadow DOM is intentionally style-isolated: no page-level <style>
// tag, no matter how specific or how many !important flags, can reach inside
// it. Coloring it requires finding the actual element *inside* the shadow
// root via JS and setting its style directly — plain CSS cannot do this.
//
// app_include_js scripts can execute before frappe's own core bundle has
// defined `frappe.ready` (script order isn't guaranteed), so this polls for
// `frappe.boot` instead of calling frappe.ready() directly.
(function () {
	function getActivePageContainer() {
		// Frappe keeps every visited route's .page-container in the DOM
		// permanently (hidden via display:none, not destroyed — confirmed
		// live), so plain querySelector(".page-container ...") is ambiguous:
		// it can match a HIDDEN older page instead of the one actually on
		// screen. Workspace pages make this worse specifically — their own
		// .list-sidebar wrapper (set up in workspace.js's prepare_container())
		// contains the real .desk-sidebar, so an unscoped
		// ".list-sidebar, .form-sidebar" query run while viewing a doctype
		// list can match the Workspace page's hidden sidebar instead of the
		// list's own, even though the Workspace page isn't visible at all.
		return Array.from(document.querySelectorAll(".page-container")).find(
			(c) => getComputedStyle(c).display !== "none"
		);
	}

	function colorWelcomeBanner(color) {
		function tryApply() {
			const containers = document.querySelectorAll(
				'[custom_block_name="Pico Dashboard Welcome Banner"]'
			);
			let applied = false;
			containers.forEach((container) => {
				const host = container.querySelector(".widget-body > *");
				const banner = host && host.shadowRoot && host.shadowRoot.querySelector(".pico-welcome-banner");
				if (banner) {
					banner.style.setProperty("background", color, "important");
					applied = true;
				}
			});
			return applied;
		}

		if (tryApply()) return;

		// The block loads asynchronously (only present on workspaces that
		// include it, well after initial page boot), so watch for it to
		// appear rather than assuming it's already there.
		const observer = new MutationObserver(() => {
			if (tryApply()) observer.disconnect();
		});
		observer.observe(document.body, { childList: true, subtree: true });
		setTimeout(() => observer.disconnect(), 15000); // give up rather than watch forever
	}

	function relocateLogo() {
		// Physically moves the real <a class="navbar-brand navbar-home"
		// href="/app"> (not a clone, not a CSS fake) into the page-title of
		// whichever page is currently visible, so it keeps working as a real
		// link: href="/app" with no further path already resolves through
		// frappe.router.make_url()'s documented order (user's default
		// workspace -> private home -> public home -> first workspace) and
		// Frappe's existing internal-link click interception, both confirmed
		// by reading router.js — no need to reimplement either.
		//
		// .navbar is a single persistent element, but each route has its OWN
		// .page-title inside its own .page-container (Frappe keeps old pages
		// in the DOM, hidden, rather than destroying them — confirmed live),
		// so the one real logo node has to be re-homed into the newly-active
		// page-title on every route change, not just once.
		function tryRelocate() {
			const brand = document.querySelector("a.navbar-brand.navbar-home");
			if (!brand) return false;
			const activeContainer = getActivePageContainer();
			const pageTitle = activeContainer && activeContainer.querySelector(".page-title");
			if (!pageTitle) return false;
			if (pageTitle.firstElementChild !== brand) {
				pageTitle.insertBefore(brand, pageTitle.firstChild);
			}
			return true;
		}

		if (tryRelocate()) return;
		let tries = 0;
		const iv = setInterval(function () {
			tries += 1;
			// Form views fetch the full document over the network before
			// rendering — confirmed live that a 2s budget (20 tries) was too
			// short and silently gave up before the page-title even existed,
			// leaving the logo stranded in a hidden old page. 100 tries (~10s)
			// matches the budget already used for the outer frappe.boot wait.
			if (tryRelocate() || tries > 100) clearInterval(iv);
		}, 100);
	}

	function injectModuleTreeSidebar() {
		// List and form views replace the usual module-tree sidebar
		// (.desk-sidebar) with their own .list-sidebar/.form-sidebar in the
		// same column — confirmed live: .desk-sidebar doesn't exist in that
		// page's DOM at all. Once desk_layout CSS hides the Assigned
		// To/Tags/Share/Connections clutter, there'd be nothing left to
		// navigate with except browser back, so clone the real module tree in.
		//
		// Frappe persists hidden pages rather than destroying them (confirmed
		// live), so the original .desk-sidebar is still in the DOM somewhere
		// after the first workspace visit each session, even while viewing an
		// unrelated list/form — cloning it live (rather than caching a copy)
		// means it's never stale. Confirmed live that clicks on a cloned
		// sidebar item work identically to the original (Frappe's sidebar
		// click handling is delegated, not bound per-element).
		function tryInject() {
			const activeContainer = getActivePageContainer();
			const sidebar = activeContainer && activeContainer.querySelector(".list-sidebar, .form-sidebar");
			if (!sidebar) return false;
			if (sidebar.querySelector(".desk-sidebar")) return true; // real Workspace page
			const original = document.querySelector(".desk-sidebar");
			if (!original) return false; // no workspace visited yet this session
			const clone = original.cloneNode(true);
			clone.classList.add("custom-theme-module-tree-clone");
			sidebar.insertBefore(clone, sidebar.firstChild);
			return true;
		}

		if (tryInject()) return;

		// .list-sidebar/.form-sidebar are rebuilt asynchronously after the
		// route change event fires, and form views specifically fetch the
		// full document over the network before rendering — confirmed live
		// that a 2s budget (20 tries) was too short for a Form route and
		// silently gave up before .form-sidebar even existed. 100 tries
		// (~10s) matches the budget already used for the outer frappe.boot
		// wait.
		let tries = 0;
		const iv = setInterval(function () {
			tries += 1;
			if (tryInject() || tries > 100) clearInterval(iv);
		}, 100);
	}

	function apply() {
		relocateLogo();
		injectModuleTreeSidebar();

		frappe.router.on("change", function () {
			// router.js's render_page() hands off to an async view factory
			// (FormFactory, ListFactory, ...) via factory.show() WITHOUT
			// awaiting it, then fires "change" immediately after — confirmed
			// live (frappe.container.page still pointed at the OLD page at the
			// instant "change" fired for a Form route, only updating once the
			// factory's own async setup, e.g. the document fetch, finished).
			// Checking DOM visibility (or even frappe.container.page) straight
			// away is unreliable: it can resolve to a stale page left over
			// from BEFORE this navigation — confirmed live this caused
			// relocateLogo/injectModuleTreeSidebar to silently treat an
			// unrelated, already-handled page as "nothing to do" when
			// navigating straight from a Workspace into a Form, rather than
			// ever reaching the new page. Waiting for frappe.container.page
			// (Frappe's own authoritative current-page pointer) to actually
			// become a different node sidesteps guessing at each factory's
			// timing: once it changes, the new page is confirmed current.
			const staleContainer = frappe.container && frappe.container.page;
			let tries = 0;
			const iv = setInterval(function () {
				tries += 1;
				const current = frappe.container && frappe.container.page;
				const settled = current && current !== staleContainer;
				if (settled || tries > 100) {
					clearInterval(iv);
					relocateLogo();
					injectModuleTreeSidebar();
				}
			}, 100);
		});

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
			`;
			colorWelcomeBanner(pref.app_color);
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
