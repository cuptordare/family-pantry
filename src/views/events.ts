import { getSignedInCode } from "../core/config";
import {
	daysFromToday,
	formatEventDate,
	formatRelativeDay,
	formatTime,
	isWeekend,
	parseLocalDate,
	setError,
	setLoading,
} from "../core/helpers";
import type { AppDataApi, CalendarEvent, UserCode } from "../core/types";
import { titleBar } from "../ui/layout";
import type { Router, View } from "../ui/router";

export function createEventsView(data: AppDataApi, router: Router): View {
	let implementation: EventsViewImpl | null = null;
	return {
		render() {
			const code = getSignedInCode();
			if (!code) {
				void router.navigateTo("home");
				return "";
			}
			implementation = new EventsViewImpl(code, data, router);
			return `<section id="events-view" class="events-view"></section>`;
		},
		async onMount() {
			await implementation?.init();
		},
		onDestroy() {
			implementation?.destroy();
			implementation = null;
		},
	};
}

class EventsViewImpl {
	private events: CalendarEvent[] = [];
	private unsubscribeEvents: (() => void) | null = null;
	private expandedIds = new Set<string>();

	constructor(
		private readonly code: UserCode,
		private readonly data: AppDataApi,
		private readonly router: Router,
	) {}

	async init(): Promise<void> {
		setLoading(true);
		setError(null);
		try {
			await this.data.getEvents();
			this.unsubscribeEvents = this.data.subscribeEvents((nextEvents) => {
				this.events = nextEvents;
				this.render();
			});
		} catch {
			setError("load-events-data");
		} finally {
			setLoading(false);
		}
	}

	destroy(): void {
		this.unsubscribeEvents?.();
		this.unsubscribeEvents = null;
		setLoading(false);
		setError(null);
	}

	private render(): void {
		const container = document.getElementById("events-view");
		if (!container) return;
		const focusedEventId =
			document.activeElement?.closest<HTMLElement>("[data-event-id]")?.dataset
				.eventId;
		container.replaceChildren();
		container.append(
			titleBar({
				code: this.code,
				currentView: "events",
				router: this.router,
				data: this.data,
			}),
		);
		const content = document.createElement("div");
		content.className = "view-content";
		content.append(this.list());
		container.append(content);
		if (focusedEventId) {
			container
				.querySelector<HTMLElement>(
					`[data-event-id="${CSS.escape(focusedEventId)}"]`,
				)
				?.focus();
		}
	}

	private upcomingEvents(): CalendarEvent[] {
		return this.events
			.filter(
				(event) =>
					(event.title ?? "").trim() && daysFromToday(event.start) >= 0,
			)
			.sort(
				(a, b) =>
					parseLocalDate(a.start).getTime() - parseLocalDate(b.start).getTime(),
			);
	}

	private toggleExpanded(id: string): void {
		if (this.expandedIds.has(id)) this.expandedIds.delete(id);
		else this.expandedIds.add(id);
		this.render();
	}

	private list(): HTMLElement {
		const el = document.createElement("div");
		el.className = "events-list";
		const upcoming = this.upcomingEvents();
		if (!upcoming.length) {
			el.innerHTML = `<div class="events-empty">No upcoming events</div>`;
			return el;
		}
		for (const event of upcoming) el.append(this.eventItem(event));
		return el;
	}

	private eventItem(event: CalendarEvent): HTMLElement {
		const el = document.createElement("div");
		el.className = "event-item";
		el.dataset.eventId = event.id;
		if (isWeekend(event.start)) el.classList.add("event-item--weekend");

		const dateColumn = document.createElement("div");
		dateColumn.className = "event-item__date-column";

		const date = document.createElement("span");
		date.className = "event-item__date";
		date.textContent = formatEventDate(event.start);

		const countdown = document.createElement("span");
		countdown.className = "event-item__countdown";
		countdown.textContent = formatRelativeDay(event.start);

		dateColumn.append(date, countdown);

		const main = document.createElement("div");
		main.className = "event-item__main";

		const title = document.createElement("span");
		title.className = "event-item__title";
		title.textContent = event.title;
		main.append(title);

		if (!event.allDay) {
			const time = document.createElement("span");
			time.className = "event-item__time";
			time.textContent = formatTime(this.localTime(event.start));
			main.append(time);
		}

		if (event.location) {
			const location = document.createElement("span");
			location.className = "event-item__location";
			location.textContent = event.location;
			main.append(location);
		}

		if (event.description && this.expandedIds.has(event.id)) {
			const description = document.createElement("span");
			description.className = "event-item__description";
			description.textContent = event.description;
			main.append(description);
		}

		el.append(dateColumn, main);

		if (event.description) {
			el.classList.add("event-item--expandable");
			el.tabIndex = 0;
			el.setAttribute("role", "button");
			el.setAttribute("aria-expanded", String(this.expandedIds.has(event.id)));
			el.addEventListener("click", () => this.toggleExpanded(event.id));
			el.addEventListener("keydown", (keyEvent) => {
				if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
				keyEvent.preventDefault();
				this.toggleExpanded(event.id);
			});
		}

		return el;
	}

	private localTime(iso: string): string {
		const date = new Date(iso);
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		return `${hours}:${minutes}`;
	}
}
