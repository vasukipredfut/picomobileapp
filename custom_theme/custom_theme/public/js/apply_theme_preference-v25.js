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

	function relocateNavbarExtras() {
		// Merges the two stacked blue bars into one, per request: "make the A
		// [avatar] ... to second layer where logo and three dots [hamburger]
		// are ... make that 1 layer top bar and remove top layer". Same
		// technique as relocateLogo() above — physically move the REAL
		// elements rather than cloning or reimplementing them, so search
		// (Ctrl+G), notifications, and the avatar dropdown all keep working
		// exactly as before, just in a new spot.
		//
		// .navbar's .collapse.navbar-collapse is one single div that already
		// contains the search bar, the (CSS-hidden) notification bell, AND
		// the avatar dropdown together — confirmed live — so moving that one
		// element brings all three at once instead of needing three separate
		// relocations.
		//
		// #navbar-breadcrumbs (a sibling of .collapse.navbar-collapse, also
		// inside .navbar) is NOT relocated — confirmed live it does get
		// populated with real content on Form routes (e.g. "Employee >
		// HR-EMP-00001"), but with the page title itself already hidden
		// elsewhere in this app's styling, a lone breadcrumb trail with
		// nothing to sit next to would look orphaned; desk_layout CSS hides
		// it outright instead, which is also what lets .navbar end up fully
		// empty and safe to hide once this function has run.
		function tryRelocate() {
			// NOT scoped to ".navbar .collapse..." — confirmed live that once
			// the first relocation succeeds, this element lives inside a
			// .page-actions, no longer a descendant of .navbar at all, so an
			// ancestor-scoped selector only ever finds it ONCE and silently
			// matches nothing on every later route change (the same mistake,
			// inverted, as the .list-sidebar/.form-sidebar scoping bug fixed
			// earlier in this file) — stranding it on whichever page happened
			// to be active the first time this function ran. The element
			// itself is a page-wide singleton, so matching it directly (like
			// a.navbar-brand.navbar-home above) works regardless of its
			// current parent.
			const collapse = document.querySelector(".collapse.navbar-collapse");
			if (!collapse) return false;
			const activeContainer = getActivePageContainer();
			const pageActions = activeContainer && activeContainer.querySelector(".page-actions");
			if (!pageActions) return false;
			if (pageActions.lastElementChild !== collapse) {
				pageActions.appendChild(collapse);
			}
			// desk_layout CSS only hides .navbar when this class is present —
			// confirming the move actually happened before hiding the original
			// location, so a failure here (rather than unconditionally hiding
			// .navbar) just leaves the old two-bar layout in place instead of
			// losing search/account access with nothing left to show it.
			document.body.classList.add("navbar-extras-relocated");
			return true;
		}

		// Always poll, never check-once-and-return — same reasoning as
		// relocateLogo()/injectModuleTreeSidebar() above: an immediate
		// synchronous check right after a route change can still see a stale
		// page left over from before the navigation.
		let tries = 0;
		const iv = setInterval(function () {
			tries += 1;
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

	function addClonedSidebarToggleHandler(clone) {
		// Replaces the per-element click handler workspace.js binds to each
		// .drop-icon (lost on clone — see the comment above tryInject() in
		// injectModuleTreeSidebar for the full explanation) with one delegated
		// handler on the clone's root, mirroring workspace.js's own
		// add_drop_icon() logic: toggle the sibling .sidebar-child-item's
		// "hidden" class, and flip the chevron's up/down icon to match.
		clone.addEventListener("click", function (e) {
			const dropIcon = e.target.closest(".drop-icon");
			if (!dropIcon || !clone.contains(dropIcon)) return;
			const itemContainer = dropIcon.closest(".sidebar-item-container");
			const childSection = itemContainer && itemContainer.querySelector(".sidebar-child-item");
			if (!childSection) return;
			childSection.classList.toggle("hidden");
			const use = dropIcon.querySelector("use");
			if (use) {
				const isNowCollapsed = childSection.classList.contains("hidden");
				use.setAttribute("href", isNowCollapsed ? "#es-line-down" : "#es-line-up");
			}
		});
	}

	function buildFallbackModuleTree() {
		// ensureWorkspaceSidebarExists()'s pre-warm is best-effort, not
		// guaranteed — confirmed live it can throw inside Frappe's own
		// Workspace constructor on a cold load (a Frappe-internal issue
		// unrelated to this app), leaving .desk-sidebar never created at all
		// for the rest of that session. When that happens there's nothing to
		// clone, which is what left the sidebar empty ("instead I want left
		// bar menu always in all doctypes").
		//
		// frappe.boot.allowed_workspaces is the same data Frappe's own
		// Workspace class uses to build .desk-sidebar (confirmed live: each
		// entry has name/title/public/parent_page/icon/is_hidden, exactly
		// what sidebar_item_container()/append_item() in workspace.js consume)
		// — it's core bootinfo, always present, so building our own minimal
		// equivalent directly from it never depends on the fragile
		// constructor. This intentionally only covers public pages and skips
		// auto-expanding/highlighting the current page's section (the real
		// sidebar's selected-state logic) — a reliable plain tree beats a
		// richer one that can silently fail to appear at all.
		const pages = (frappe.boot && frappe.boot.allowed_workspaces) || [];
		const publicPages = pages.filter((p) => p.public && !p.is_hidden);
		if (!publicPages.length) return null;

		function childrenOf(title) {
			return publicPages.filter((p) => p.parent_page === title);
		}

		function renderItem(item) {
			const children = childrenOf(item.title);
			const container = document.createElement("div");
			container.className = "sidebar-item-container";
			container.setAttribute("item-name", item.title);

			const standardItem = document.createElement("div");
			standardItem.className = "desk-sidebar-item standard-sidebar-item";
			container.appendChild(standardItem);

			const anchor = document.createElement("a");
			anchor.className = "item-anchor";
			anchor.href = "/app/" + frappe.router.slug(item.title);
			anchor.title = item.title;
			standardItem.appendChild(anchor);

			const iconSpan = document.createElement("span");
			iconSpan.className = "sidebar-item-icon";
			iconSpan.setAttribute("item-icon", item.icon || "folder-normal");
			iconSpan.innerHTML =
				'<svg class="icon icon-md" aria-hidden="true"><use href="#icon-' +
				(item.icon || "folder-normal") +
				'"></use></svg>';
			anchor.appendChild(iconSpan);

			const labelSpan = document.createElement("span");
			labelSpan.className = "sidebar-item-label";
			labelSpan.textContent = item.title;
			anchor.appendChild(labelSpan);

			const control = document.createElement("div");
			control.className = "sidebar-item-control";
			standardItem.appendChild(control);

			if (children.length) {
				const dropIcon = document.createElement("button");
				dropIcon.className = "btn-reset drop-icon";
				dropIcon.innerHTML =
					'<svg class="es-icon es-line icon-sm" aria-hidden="true"><use href="#es-line-down"></use></svg>';
				control.appendChild(dropIcon);

				const childSection = document.createElement("div");
				childSection.className = "sidebar-child-item nested-container hidden";
				children.forEach((child) => childSection.appendChild(renderItem(child)));
				container.appendChild(childSection);
			}

			return container;
		}

		const tree = document.createElement("div");
		// Also carries .custom-theme-module-tree-clone (not just
		// .custom-theme-fallback-tree) so it automatically inherits every CSS
		// fix already written for the cloned tree — most importantly
		// ".custom-theme-module-tree-clone .item-anchor { display: flex }",
		// without which icon+label would stack vertically here exactly like
		// the original clone did before that fix (same underlying cause:
		// Frappe's own flex-row rule for .item-anchor only applies within a
		// real Workspace page's wrapper, which neither this tree nor the
		// clone has).
		tree.className =
			"desk-sidebar list-unstyled sidebar-menu custom-theme-fallback-tree custom-theme-module-tree-clone";
		const section = document.createElement("div");
		section.className = "standard-sidebar-section nested-container";
		tree.appendChild(section);
		publicPages
			.filter((p) => !p.parent_page)
			.forEach((root) => section.appendChild(renderItem(root)));

		return tree;
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
		// means it's never stale. Confirmed live that clicks on navigation
		// links in a cloned sidebar item work identically to the original:
		// they're real <a href> tags, and Frappe intercepts internal link
		// clicks via a document-level delegated handler that doesn't care
		// whether the clicked node is the "original" or a clone.
		//
		// The expand/collapse chevron (.drop-icon) is a DIFFERENT story,
		// confirmed by reading workspace.js: Frappe binds its click handler
		// directly to that specific button instance via $drop_icon.on("click",
		// ...) — not delegated — and cloneNode(true) never copies JS event
		// listeners, only DOM structure. So a cloned chevron looks identical
		// but is completely inert. The children it should reveal ARE already
		// in the clone's DOM (workspace.js builds every module's children
		// upfront and only CSS-hides collapsed ones via a .hidden class on
		// .sidebar-child-item — confirmed live, e.g. Payroll Module's 6
		// children exist in the DOM even while collapsed) — there's just no
		// listener left to toggle that class. addClonedSidebarToggleHandler()
		// below replaces it with our own.
		function alreadyInjected(sidebar) {
			return !!sidebar.querySelector(
				".desk-sidebar, .custom-theme-module-tree-clone, .custom-theme-fallback-tree"
			);
		}

		function tryInject() {
			const activeContainer = getActivePageContainer();
			const sidebar = activeContainer && activeContainer.querySelector(".list-sidebar, .form-sidebar");
			if (!sidebar) return false;
			if (alreadyInjected(sidebar)) return true;
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
			addClonedSidebarToggleHandler(clone);
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
			if (tryInject()) {
				clearInterval(iv);
				return;
			}
			// ensureWorkspaceSidebarExists()'s pre-warm is best-effort — confirmed
			// live it can throw inside Frappe's own Workspace constructor on a
			// cold load, in which case .desk-sidebar never becomes available NO
			// MATTER how long this keeps polling ("I want left bar menu always
			// in all doctypes" — confirmed live this is exactly the gap: the
			// sidebar stayed empty with nothing to clone). 20 tries (~2s) is
			// enough budget for the NORMAL success case (confirmed live that
			// typically resolves within 1-2 ticks once the async workspace
			// fetch completes) without leaving a real failure staring at an
			// empty sidebar for the full 10s budget used elsewhere in this
			// file. Falling back to a tree built straight from boot data — not
			// dependent on the fragile constructor at all — instead of giving
			// up.
			if (tries > 20) {
				clearInterval(iv);
				const activeContainer = getActivePageContainer();
				const sidebar = activeContainer && activeContainer.querySelector(".list-sidebar, .form-sidebar");
				if (sidebar && !alreadyInjected(sidebar)) {
					const fallback = buildFallbackModuleTree();
					if (fallback) {
						addClonedSidebarToggleHandler(fallback);
						sidebar.insertBefore(fallback, sidebar.firstChild);
					}
				}
			}
		}, 100);
	}

	function watchForInPlaceRefresh() {
		// frappe.router.on("change") alone misses any refresh that doesn't
		// change the route — confirmed live: cur_frm.savesubmit() (and
		// reload_doc()) rebuild the form's DOM in place, including wiping out
		// and recreating .form-sidebar's children, with no route change at
		// all, silently dropping our injected module tree until the user
		// manually reloads the page. frappe.ui.form.on("*", {refresh: ...})
		// looks like the obvious hook but does NOT fire in this Frappe
		// version — confirmed live: a doctype-specific registration (e.g.
		// "Salary Structure") fires fine, but "*" never does, and hardcoding
		// every doctype isn't viable. A MutationObserver sidesteps guessing
		// the triggering event entirely: it reacts to the DOM actually
		// changing, whatever caused it (submit, reload_doc, cancel, amend,
		// future Frappe versions, ...), so it stays correct even if Frappe's
		// internal event wiring changes again.
		//
		// Debounced rather than re-running on every mutation record: a form
		// rebuild fires many childList mutations in a single burst, and
		// relocateLogo()/relocateNavbarExtras() each start their own ~10s
		// poll loop per call — collapsing a burst into one trailing call
		// avoids stacking dozens of redundant poll loops.
		let debounceTimer = null;
		const observer = new MutationObserver(function () {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(function () {
				relocateLogo();
				relocateNavbarExtras();
				injectModuleTreeSidebar();
			}, 150);
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	// Sidebar entries added by custom_theme.patches.setup_sidebar_menu's
	// "reports" MODULES key (Employee Checkin/Attendance/Leave
	// Application/Leave Balance under HR Module, Customer/Lead under Sales
	// Module). Each is backed by a real Workspace + Shortcut so it appears in
	// frappe.boot.allowed_workspaces like any other sidebar child — but
	// workspace.js's own sidebar builder can only link a child item to a bare
	// /app/<slug> route (it builds href from frappe.router.slug(item.title),
	// completely ignoring the shortcut's own type/link_to — confirmed by
	// reading sidebar_item_container() in workspace.js). That happens to work
	// for plain DocType entries because their title IS the doctype's own
	// route slug, but a named Report has no single-segment route of its own
	// (a Report Builder report lives at List/<doctype>/Report/<name>, a
	// Script/Query Report at query-report/<name> — confirmed live for both).
	// So these entries' real navigation is handled entirely by this file via
	// a capture-phase click interceptor, keyed by the sidebar item's visible
	// label text (each of these 6 labels is unique across the whole sidebar,
	// so no parent-module disambiguation is needed).
	const REPORT_SIDEBAR_LINKS = [
		{ label: "Employee Checkin", kind: "report-builder", doctype: "Employee Checkin", report: "Employee Checkin", companyField: null },
		{ label: "Attendance", kind: "report-builder", doctype: "Attendance", report: "Attendance", companyField: "company" },
		{ label: "Leave Application", kind: "report-builder", doctype: "Leave Application", report: "Leave Application", companyField: "company" },
		{ label: "Leave Balance", kind: "query-report", report: "Employee Leave Balance", companyField: "company" },
		// Customer has no companyField: confirmed reading customer.json — it
		// carries no direct Link-to-Company field at all (only "companies", a
		// multi-company "Allowed To Transact With" child table, and
		// "represents_company" which only applies to internal customers), so
		// there's no single field to pre-fill a company default into.
		{ label: "Customer", kind: "report-builder", doctype: "Customer", report: "Customer", companyField: null },
		{ label: "Lead", kind: "report-builder", doctype: "Lead", report: "Lead", companyField: "company" },
	];

	function routeForReportLink(cfg) {
		return cfg.kind === "query-report" ? ["query-report", cfg.report] : ["List", cfg.doctype, "Report", cfg.report];
	}

	function matchReportLinkForRoute(route) {
		return REPORT_SIDEBAR_LINKS.find((cfg) => {
			const target = routeForReportLink(cfg);
			return target.length === route.length && target.every((part, i) => part === route[i]);
		});
	}

	function setupReportSidebarLinks() {
		// Capture phase + confined to the sidebar: only ever acts on clicks
		// inside .list-sidebar/.form-sidebar (the module tree lives there,
		// cloned or fallback alike — see injectModuleTreeSidebar above), never
		// on coincidentally-matching text anywhere else on the page.
		document.addEventListener(
			"click",
			function (e) {
				const sidebar = e.target.closest(".list-sidebar, .form-sidebar");
				if (!sidebar) return;
				const anchor = e.target.closest(".item-anchor");
				if (!anchor) return;
				const labelEl = anchor.querySelector(".sidebar-item-label");
				const label = labelEl ? labelEl.textContent.trim() : "";
				const cfg = REPORT_SIDEBAR_LINKS.find((c) => c.label === label);
				if (!cfg) return;
				e.preventDefault();
				e.stopPropagation();
				frappe.set_route.apply(frappe, routeForReportLink(cfg));
			},
			true
		);

		// One-shot per fresh navigation, not reactive to every DOM mutation —
		// deliberately NOT wired into watchForInPlaceRefresh()'s
		// MutationObserver above, which would re-apply (fighting) the filter
		// on every keystroke/filter edit the user makes on the page, turning
		// a "convenience default" into something that looks like it can't be
		// removed. Confirmed live that changing/adding a list filter does NOT
		// fire frappe.router.on("change") (filter_area.add() on an existing
		// list leaves frappe.get_route() and location unchanged), so gating on
		// route-change alone is sufficient to apply it exactly once per visit
		// without re-fighting the user's own edits afterward.
		let lastAutoFilledRoute = null;
		frappe.router.on("change", function () {
			const route = frappe.get_route();
			const routeStr = route.join("/");
			if (routeStr === lastAutoFilledRoute) return;
			const cfg = matchReportLinkForRoute(route);
			if (!cfg || !cfg.companyField) return;
			const company = frappe.boot && frappe.boot.custom_theme_current_company;
			if (!company) return;
			lastAutoFilledRoute = routeStr;

			let tries = 0;
			let filterAddInFlight = false;
			const iv = setInterval(function () {
				tries += 1;
				// Re-check we're still on the route we started this poll for —
				// same race as relocateLogo()/tryInject() elsewhere in this
				// file: the user could navigate away before cur_list/
				// frappe.query_report finish loading for this one.
				if (frappe.get_route().join("/") !== routeStr) {
					clearInterval(iv);
					return;
				}
				if (
					cfg.kind === "report-builder" &&
					window.cur_list &&
					cur_list.doctype === cfg.doctype &&
					cur_list.filter_area &&
					!filterAddInFlight
				) {
					// .add() can still reject with "Filter missing" even after the
					// filter_area/doctype readiness check above — confirmed live,
					// the filter row's input widget isn't necessarily rendered yet
					// at that exact instant. Retried on the next tick rather than
					// giving up after one attempt (NOT clearing the interval here),
					// relying on the tries>50 cap below as the ultimate backstop —
					// this is a best-effort convenience default, not something
					// that should surface as an uncaught console error, but
					// silently never applying it on the first transient failure
					// would be worse than retrying a few times.
					filterAddInFlight = true;
					cur_list.filter_area
						.add([[cfg.doctype, cfg.companyField, "=", company]])
						.then(function () {
							clearInterval(iv);
						})
						.catch(function () {
							filterAddInFlight = false;
						});
					return;
				}
				if (
					cfg.kind === "query-report" &&
					frappe.query_report &&
					frappe.query_report.report_name === cfg.report &&
					frappe.query_report.filters
				) {
					frappe.query_report.set_filter_value(cfg.companyField, company);
					clearInterval(iv);
					return;
				}
				if (tries > 50) clearInterval(iv); // ~5s — give up rather than poll forever
			}, 100);
		});
	}

	function apply() {
		ensureWorkspaceSidebarExists();
		relocateLogo();
		relocateNavbarExtras();
		injectModuleTreeSidebar();
		frappe.router.on("change", function () {
			relocateLogo();
			relocateNavbarExtras();
			injectModuleTreeSidebar();
		});
		watchForInPlaceRefresh();
		setupReportSidebarLinks();

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
