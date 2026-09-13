import { createEnvelope, type SyncAdapter } from "localsync";
import { APP_DATA_SECRET, APP_DATA_URL } from "./secrets";
import type { CalendarEvent, EventsRecord } from "./types";

export const EVENTS_RECORD_ID = "events:shared";

async function fetchEvents(): Promise<CalendarEvent[]> {
	const response = await fetch(APP_DATA_URL, {
		method: "POST",
		body: JSON.stringify({
			secret: APP_DATA_SECRET,
			action: "getEvents",
			data: { days: 90 },
		}),
	});

	if (!response.ok) {
		throw new Error(`Google Calendar request failed: ${response.status}`);
	}

	const payload: unknown = await response.json();
	if (!Array.isArray(payload)) {
		// Apps Script returns a plain {error: "..."} object (not an array) on
		// exceptions -- e.g. a missing Calendar OAuth scope. Fail the sync
		// instead of caching that object as if it were the events list.
		throw new Error(
			`Unexpected getEvents response: ${JSON.stringify(payload)}`,
		);
	}
	return payload as CalendarEvent[];
}

export function createCalendarSyncAdapter(): SyncAdapter<EventsRecord> {
	return {
		async pull() {
			const events = await fetchEvents();
			return {
				records: [
					createEnvelope(
						{ events },
						{ id: EVENTS_RECORD_ID, source: "remote", dirty: false },
					),
				],
			};
		},
	};
}
