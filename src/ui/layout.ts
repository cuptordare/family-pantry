import { APP_NAME, getUserByCode } from "../core/config";
import { icon } from "../core/helpers";
import type { AppDataApi, RouteName, UserCode } from "../core/types";
import { icons } from "./icons";
import type { Router } from "./router";

let activeMenu: HamburgerMenu | null = null;
let activeTitleCleanup: (() => void) | null = null;

export function destroyLayoutChrome(): void {
	activeMenu?.destroy();
	activeMenu = null;
	activeTitleCleanup?.();
	activeTitleCleanup = null;
}

export function titleBar({
	code,
	currentView,
	router,
	data,
	showViewIcons = false,
}: {
	code: UserCode;
	currentView: RouteName;
	router: Router;
	data: AppDataApi;
	showViewIcons?: boolean;
}): HTMLElement {
	destroyLayoutChrome();
	const el = document.createElement("div");
	el.className = "view-title-bar";

	const title = document.createElement("div");
	title.className = "view-title";
	title.textContent =
		currentView === "todo"
			? "To-Do List"
			: currentView === "schedule"
				? "Weekly Schedule"
				: currentView === "events"
					? "Upcoming Events"
					: APP_NAME;

	activeMenu = new HamburgerMenu(code, router, data);
	el.append(activeMenu.build(), title);

	const syncIndicator = document.createElement("span");
	syncIndicator.className = "sync-indicator";
	syncIndicator.title = "Sync in progress";
	syncIndicator.setAttribute("aria-label", "Sync in progress");
	el.append(syncIndicator);
	activeTitleCleanup = data.subscribeSyncActivity((busy) => {
		syncIndicator.classList.toggle("sync-indicator--active", busy);
	});

	if (showViewIcons) {
		el.insertAdjacentHTML(
			"beforeend",
			`
			<a href="#" class="view-menu-item" data-navigate-to="pantry" ${currentView === "pantry" ? "data-active" : ""} aria-label="Pantry">${icon(icons.user)}</a>
			<a href="#" class="view-menu-item" data-navigate-to="store" ${currentView === "store" ? "data-active" : ""} aria-label="Store">${icon(icons.store)}</a>
		`,
		);
		el.addEventListener("click", (event) => {
			const target = event.target;
			if (target instanceof Element && target.closest("[data-active]")) {
				void data.clearCache();
			}
		});
	}

	return el;
}

class HamburgerMenu {
	private isOpen = false;
	private button: HTMLButtonElement | null = null;
	private sidebar: HTMLElement | null = null;
	private overlay: HTMLElement | null = null;
	private readonly escapeHandler = (event: KeyboardEvent) => {
		if (event.key === "Escape") this.hide();
	};

	constructor(
		private readonly code: UserCode,
		private readonly router: Router,
		private readonly data: AppDataApi,
	) {}

	build(): HTMLButtonElement {
		this.button = document.createElement("button");
		this.button.className = "hamburger-btn";
		this.button.setAttribute("aria-label", "Open menu");
		this.button.innerHTML = icon(icons.menu);

		this.overlay = document.createElement("div");
		this.overlay.className = "sidebar-overlay";
		document.body.append(this.overlay);

		this.sidebar = this.buildSidebar();
		document.body.append(this.sidebar);

		this.button.addEventListener("click", () =>
			this.isOpen ? this.hide() : this.show(),
		);
		this.overlay.addEventListener("click", () => this.hide());
		document.addEventListener("keydown", this.escapeHandler);

		return this.button;
	}

	destroy(): void {
		document.removeEventListener("keydown", this.escapeHandler);
		this.button?.remove();
		this.sidebar?.remove();
		this.overlay?.remove();
	}

	private show(): void {
		this.isOpen = true;
		this.button?.classList.add("open");
		this.sidebar?.classList.add("open");
		this.overlay?.classList.add("open");
	}

	private hide(): void {
		this.isOpen = false;
		this.button?.classList.remove("open");
		this.sidebar?.classList.remove("open");
		this.overlay?.classList.remove("open");
	}

	private buildSidebar(): HTMLElement {
		const user = getUserByCode(this.code);
		const current = this.router.getCurrentRoute();
		const sidebar = document.createElement("nav");
		sidebar.className = "sidebar left";
		sidebar.innerHTML = `
			<div class="user">
				<div class="user-bubble">${this.code.substring(0, 2).toLowerCase()}</div>
				<div class="user-info">
					<div class="user-name">${user?.name ?? "User"}</div>
					<div class="user-nickname">${user?.nickname ?? ""}</div>
				</div>
			</div>
			<a href="#" data-navigate-to="pantry" ${current === "pantry" || current === "store" ? "data-active" : ""}>${icon(icons.food)} Family Pantry</a>
			<a href="#" data-navigate-to="todo" ${current === "todo" ? "data-active" : ""}>${icon(icons.todo)} To-Do List</a>
			<a href="#" data-navigate-to="schedule" ${current === "schedule" ? "data-active" : ""}>${icon(icons.calendar)} Schedule</a>
			<a href="#" data-navigate-to="events" ${current === "events" ? "data-active" : ""}>${icon(icons.list)} Events</a>
			<button class="sidebar-sync" data-force-sync>${icon(icons.check, 18)} Sync now</button>
		`;
		sidebar.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			if (target.closest("a")) this.hide();
			if (target.closest("[data-force-sync]")) {
				this.hide();
				void this.data.sync();
			}
		});
		return sidebar;
	}
}
