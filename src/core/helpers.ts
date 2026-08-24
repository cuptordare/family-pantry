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
