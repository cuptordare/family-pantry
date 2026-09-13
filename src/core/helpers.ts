export function byId<T extends HTMLElement>(id: string): T {
	const element = document.getElementById(id);
	if (!(element instanceof HTMLElement)) {
		throw new Error(`Missing element #${id}`);
	}
	return element as T;
}

export function sortItems(items: string[]): string[] {
	return [...items].sort((a, b) =>
		a.toLowerCase().localeCompare(b.toLowerCase()),
	);
}

export function titleCase(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.split(" ")
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export function generateId(): string {
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function formatTime(time24: string): string {
	if (!time24) return "";
	const [hoursText, minutes = "00"] = time24.split(":");
	const hours = Number.parseInt(hoursText ?? "0", 10);
	const ampm = hours >= 12 ? "pm" : "am";
	const h12 = hours % 12 || 12;
	return `${h12}:${minutes}${ampm}`;
}

export function formatTimeRange(startTime: string, endTime: string): string {
	if (!startTime && !endTime) return "";
	return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

/** Parses an ISO instant or a bare "yyyy-MM-dd" date as a LOCAL calendar date. */
export function parseLocalDate(value: string): Date {
	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (dateOnly) {
		const [, year, month, day] = dateOnly;
		return new Date(Number(year), Number(month) - 1, Number(day));
	}
	return new Date(value);
}

function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysFromToday(value: string, now = new Date()): number {
	const target = startOfDay(parseLocalDate(value));
	const today = startOfDay(now);
	const msPerDay = 24 * 60 * 60 * 1000;
	return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

export function isWeekend(value: string): boolean {
	const day = parseLocalDate(value).getDay();
	return day === 0 || day === 6;
}

export function formatRelativeDay(value: string, now = new Date()): string {
	const diff = daysFromToday(value, now);
	if (diff === 0) return "Today";
	if (diff === 1) return "Tomorrow";
	if (diff < 0) return diff === -1 ? "Yesterday" : `${-diff} days ago`;
	if (diff < 7) return `In ${diff} days`;
	if (diff < 30) {
		const weeks = Math.round(diff / 7);
		return `In ${weeks} week${weeks === 1 ? "" : "s"}`;
	}
	const months = Math.round(diff / 30);
	return `In ${months} month${months === 1 ? "" : "s"}`;
}

export function formatEventDate(value: string): string {
	return parseLocalDate(value).toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

export function setLoading(loading: boolean): void {
	document.body.toggleAttribute("data-loading", loading);
}

export function setError(error: string | null): void {
	if (error) document.body.setAttribute("data-error", error);
	else document.body.removeAttribute("data-error");
}

export function icon(path: string, size = 24): string {
	return `<svg aria-hidden="true" viewBox="0 -960 960 960" width="${size}" height="${size}"><path d="${path}"></path></svg>`;
}
