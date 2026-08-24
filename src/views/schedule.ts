import { DAY_LABELS, DAYS, getSignedInCode } from "../core/config";
import {
	formatTimeRange,
	generateId,
	icon,
	setError,
	setLoading,
	titleCase,
} from "../core/helpers";
import type {
	AppDataApi,
	DayName,
	ScheduleEvent,
	ScheduleRecord,
	UserCode,
} from "../core/types";
import { icons } from "../ui/icons";
import { titleBar } from "../ui/layout";
import type { Router, View } from "../ui/router";

export function createScheduleView(data: AppDataApi, router: Router): View {
	let implementation: ScheduleViewImpl | null = null;
	return {
		render() {
			const code = getSignedInCode();
			if (!code) {
				void router.navigateTo("home");
				return "";
			}
			implementation = new ScheduleViewImpl(code, data, router);
			return `<section id="schedule-view" class="schedule-view"></section>`;
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

class ScheduleViewImpl {
	private state: ScheduleRecord | null = null;
	private pendingSyncedState: ScheduleRecord | null = null;
	private modalInProgress = false;
	private unsubscribeSchedule: (() => void) | null = null;

	constructor(
		private readonly code: UserCode,
		private readonly data: AppDataApi,
		private readonly router: Router,
	) {}

	async init(): Promise<void> {
		setLoading(true);
		setError(null);
		try {
			await this.data.getSchedule();
			this.unsubscribeSchedule = this.data.subscribeSchedule((nextState) => {
				if (this.modalInProgress) {
					this.pendingSyncedState = nextState;
					return;
				}
				this.state = nextState;
				this.render();
			});
		} catch {
			setError("load-schedule-data");
		} finally {
			setLoading(false);
		}
	}

	destroy(): void {
		this.unsubscribeSchedule?.();
		this.unsubscribeSchedule = null;
		setLoading(false);
		setError(null);
		document.getElementById("event-modal")?.remove();
	}

	private render(): void {
		const container = document.getElementById("schedule-view");
		if (!container || !this.state) return;
		container.replaceChildren();
		container.append(
			titleBar({
				code: this.code,
				currentView: "schedule",
				router: this.router,
				data: this.data,
			}),
		);
		const content = document.createElement("div");
		content.className = "view-content";
		for (const day of DAYS) content.append(this.daySection(day));
		container.append(content, this.modal());
	}

	private daySection(day: DayName): HTMLElement {
		const el = document.createElement("div");
		el.className = "schedule-day";
		el.innerHTML = `
			<div class="schedule-day__header">
				<span>${DAY_LABELS[day]}</span>
				<button data-add-day="${day}">+ Add</button>
			</div>
		`;
		const events = [...(this.state?.[day] ?? [])].sort((a, b) =>
			a.startTime.localeCompare(b.startTime),
		);
		if (!events.length) {
			el.insertAdjacentHTML(
				"beforeend",
				`<div class="schedule-empty">No events</div>`,
			);
		} else {
			for (const event of events) el.append(this.eventItem(day, event));
		}
		el.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const addDay = target.closest<HTMLElement>("[data-add-day]")?.dataset
				.addDay as DayName | undefined;
			if (addDay) this.showModal(addDay);
		});
		return el;
	}

	private eventItem(day: DayName, event: ScheduleEvent): HTMLElement {
		const el = document.createElement("div");
		el.className = "schedule-event";
		el.innerHTML = `
			<span class="schedule-event__time">${formatTimeRange(event.startTime, event.endTime)}</span>
			<span class="schedule-event__title">${event.title}</span>
			<div class="schedule-event__actions">
				<button data-edit-event="${event.id}" data-day="${day}" title="Edit" class="button--icon-only">${icon(icons.edit, 18)}</button>
				<button data-delete-event="${event.id}" data-day="${day}" title="Delete" class="button--icon-only">${icon(icons.delete, 18)}</button>
			</div>
		`;
		el.addEventListener("click", (click) => {
			const target = click.target;
			if (!(target instanceof Element)) return;
			const edit = target.closest<HTMLElement>("[data-edit-event]");
			const del = target.closest<HTMLElement>("[data-delete-event]");
			if (edit)
				this.showModal(edit.dataset.day as DayName, edit.dataset.editEvent);
			if (del)
				void this.deleteEvent(
					del.dataset.day as DayName,
					del.dataset.deleteEvent ?? "",
				);
		});
		return el;
	}

	private modal(): HTMLElement {
		const el = document.createElement("div");
		el.id = "event-modal";
		el.className = "modal";
		el.innerHTML = `
			<div class="modal-shell top">
				<div class="modal-content event-content">
					<h3 id="eventModalTitle">Add Event</h3>
					<label>Copy In</label>
					<select id="eventRepeat"><option value=""></option>${this.uniqueEvents()
						.map(
							(event) =>
								`<option value="${event.title}::${event.startTime}::${event.endTime}">${event.title}: ${formatTimeRange(event.startTime, event.endTime)}</option>`,
						)
						.join("")}</select>
					<div class="event-or">or...</div>
					<label>Title</label>
					<input type="text" id="eventTitle" placeholder="e.g., Kaylie's School" />
					<div class="time-grid">
						<label>Start Time<input type="time" id="eventStartTime" /></label>
						<label>End Time<input type="time" id="eventEndTime" /></label>
					</div>
					<div class="modal-actions">
						<button id="eventSaveBtn">Save</button>
						<button id="eventCancelBtn" class="secondary">Cancel</button>
					</div>
				</div>
			</div>
		`;
		el.querySelector("#eventRepeat")?.addEventListener("change", (event) => {
			const select = event.target;
			if (!(select instanceof HTMLSelectElement) || !select.value) return;
			const [title = "", startTime = "", endTime = ""] =
				select.value.split("::");
			(el.querySelector("#eventTitle") as HTMLInputElement).value = title;
			(el.querySelector("#eventStartTime") as HTMLInputElement).value =
				startTime;
			(el.querySelector("#eventEndTime") as HTMLInputElement).value = endTime;
			select.value = "";
		});
		return el;
	}

	private uniqueEvents(): ScheduleEvent[] {
		if (!this.state) return [];
		const seen = new Set<string>();
		const events: ScheduleEvent[] = [];
		for (const day of DAYS) {
			for (const event of this.state[day]) {
				const key = `${event.title}::${event.startTime}::${event.endTime}`;
				if (seen.has(key)) continue;
				seen.add(key);
				events.push(event);
			}
		}
		return events.sort((a, b) => a.title.localeCompare(b.title));
	}

	private showModal(day: DayName, eventId?: string): void {
		if (!this.state) return;
		this.modalInProgress = true;
		const modal = document.getElementById("event-modal");
		const shell = modal?.querySelector(".modal-shell");
		if (!modal || !shell) {
			this.modalInProgress = false;
			return;
		}
		const existing = eventId
			? this.state[day].find((event) => event.id === eventId)
			: undefined;
		const title = modal.querySelector("#eventModalTitle");
		const titleInput = modal.querySelector("#eventTitle") as HTMLInputElement;
		const startInput = modal.querySelector(
			"#eventStartTime",
		) as HTMLInputElement;
		const endInput = modal.querySelector("#eventEndTime") as HTMLInputElement;
		const saveButton = modal.querySelector("#eventSaveBtn");
		const cancelButton = modal.querySelector("#eventCancelBtn");
		if (title) title.textContent = existing ? "Edit Event" : "Add Event";
		titleInput.value = existing?.title ?? "";
		startInput.value = existing?.startTime ?? "";
		endInput.value = existing?.endTime ?? "";

		const close = (applyPending = true) => {
			shell.classList.remove("show");
			modal.classList.remove("show");
			saveButton?.removeEventListener("click", save);
			cancelButton?.removeEventListener("click", cancel);
			this.modalInProgress = false;
			if (!applyPending || !this.pendingSyncedState) return;
			this.state = this.pendingSyncedState;
			this.pendingSyncedState = null;
			this.render();
		};
		const cancel = () => close(true);
		const save = async () => {
			const eventTitle = titleCase(titleInput.value);
			if (!eventTitle) {
				window.alert("Please enter a title");
				return;
			}
			const nextState = this.pendingSyncedState ?? this.state;
			if (!nextState) return;
			if (eventId) {
				const event = nextState[day].find((item) => item.id === eventId);
				if (event) {
					event.title = eventTitle;
					event.startTime = startInput.value;
					event.endTime = endInput.value;
				}
			} else {
				nextState[day].push({
					id: generateId(),
					title: eventTitle,
					startTime: startInput.value,
					endTime: endInput.value,
				});
			}
			this.state = nextState;
			this.pendingSyncedState = null;
			close(false);
			await this.saveState(nextState);
		};

		modal.classList.add("show");
		requestAnimationFrame(() => {
			shell.classList.add("show");
			titleInput.focus();
		});
		saveButton?.addEventListener("click", save);
		cancelButton?.addEventListener("click", cancel);
	}

	private async deleteEvent(day: DayName, eventId: string): Promise<void> {
		if (!this.state) return;
		this.state[day] = this.state[day].filter((event) => event.id !== eventId);
		await this.save();
	}

	private async save(): Promise<void> {
		if (!this.state) return;
		await this.data.saveSchedule(this.state);
		this.render();
	}

	private async saveState(state: ScheduleRecord): Promise<void> {
		await this.data.saveSchedule(state);
		this.render();
	}
}
