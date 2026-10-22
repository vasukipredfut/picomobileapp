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

		// Always poll — never check once synchronously and return early on
		// success. router.js's render_page() hands a route off to its async
		// view factory (FormFactory, ListFactory, ...) via factory.show()
		// WITHOUT awaiting it, then fires "change" immediately after,
		// confirmed live: at that exact instant getActivePageContainer() can
		// still resolve to a stale page left over from BEFORE this
		// navigation. An immediate synchronous check run right there can hit
		// that stale page, find it ALREADY relocated (from a previous visit),
		// and wrongly report "nothing to do" — confirmed live this happened
		// whenever a Form route followed an already-fixed List route,
		// silently stranding the logo on the old page forever, since nothing
		// else would ever re-check. Always entering the poll loop instead
		// means every tick freshly re-resolves the active container via
		// tryRelocate() itself, so it naturally converges once the real page
		// is ready, however many ticks that takes — typically just one.
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

	function ensureWorkspaceSidebarExists() {
		// injectModuleTreeSidebar() below needs a real .desk-sidebar already in
		// the DOM to clone from, which normally exists because Frappe keeps
		// every visited page in the DOM (hidden, not destroyed) once a
		// Workspace page has been shown this session. But a full page
		// load/refresh landing DIRECTLY on a list or form URL never shows a
		// Workspace page at all this session — confirmed live (.desk-sidebar
		// simply doesn't exist anywhere after a fresh load straight into
		// /app/employee), which is why the cloned sidebar disappeared on
		// reload: there was nothing to clone.
		//
		// frappe.standard_pages["Workspaces"] is the exact function Frappe's
		// own router calls the FIRST time the Workspaces page is needed — it
		// creates the page and sidebar skeleton synchronously and populates it
		// asynchronously, but critically does NOT navigate or display
		// anything (confirmed live: calling it leaves frappe.get_route()
		// unchanged and the new page's display stays "none"). Calling it here
		// ourselves pre-warms the sidebar in the background. Frappe's router
		// only ever calls this factory once per session (reusing
		// frappe.pages["Workspaces"] afterward), so pre-warming it doesn't
		// duplicate or conflict with a later real visit to the dashboard —
		// confirmed live that navigating to Home Dashboard afterward still
		// works normally and reuses the same pre-warmed page.
		//
		// One side effect to undo: calling it also overwrites document.title
		// (confirmed live: it changed to "Workspace" even though nothing was
		// actually navigated to), so the title is captured and restored
		// around the call.
		//
		// Wrapped in try/catch: confirmed live that calling this factory
		// out-of-band (not via a normal router-driven navigation) can throw
		// deep inside Frappe's own Workspace constructor — TypeError: Cannot
		// read properties of null (reading 'join'), on a fresh load straight
		// into a list route, some route-dependent global state the
		// constructor assumes isn't fully set up yet. An uncaught throw here
		// aborted apply() entirely, silently breaking relocateLogo and
		// injectModuleTreeSidebar's router.on("change") registration too —
		// pre-warming is a nice-to-have and must never be able to take those
		// down with it.
		if (frappe.pages && frappe.pages["Workspaces"]) return; // already warmed (or really viewing it)
		if (!frappe.standard_pages || typeof frappe.standard_pages["Workspaces"] !== "function") return;
		const originalTitle = document.title;
		try {
			frappe.standard_pages["Workspaces"]();
		} catch (e) {
			// swallow — see comment above
		}
		document.title = originalTitle;
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
			// ensureWorkspaceSidebarExists() creates .desk-sidebar's skeleton
			// synchronously but populates its items asynchronously (fetched from
			// the server) — confirmed live. Without checking for an actual item,
			// a pre-warmed-but-not-yet-populated sidebar would get cloned empty,
			// and since a success here stops the retry loop, that empty clone
			// would be permanent.
			if (!original || !original.querySelector(".sidebar-item-container")) return false;
			const clone = original.cloneNode(true);
			clone.classList.add("custom-theme-module-tree-clone");
			sidebar.insertBefore(clone, sidebar.firstChild);
			return true;
		}

		// Always poll — never check once synchronously and return early on
		// success. Same race as relocateLogo() above: an immediate check can
		// hit a stale page left over from before this navigation and wrongly
		// read its OWN already-injected clone as "this route needs nothing" —
		// confirmed live this silently stranded the module tree off the real
		// new page whenever a Form route followed an already-fixed List
		// route. tryInject() re-resolves the active container fresh on every
		// tick, so always polling converges correctly regardless of how many
		// ticks the real page takes to become ready.
		let tries = 0;
		const iv = setInterval(function () {
			tries += 1;
			// Form views fetch the full document over the network before
			// rendering — confirmed live that a 2s budget (20 tries) was too
			// short and silently gave up before .form-sidebar even existed.
			// 100 tries (~10s) matches the budget already used for the outer
			// frappe.boot wait.
			if (tryInject() || tries > 100) clearInterval(iv);
		}, 100);
	}

	function apply() {
		ensureWorkspaceSidebarExists();
		relocateLogo();
		injectModuleTreeSidebar();
		frappe.router.on("change", function () {
			relocateLogo();
			injectModuleTreeSidebar();
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
