import type { Mutation, RecordEnvelope, SyncAdapter } from "localsync";
import { APP_DATA_SECRET, APP_DATA_URL } from "./secrets";

interface RemotePayload<T extends object> {
	records: RecordEnvelope<T>[];
}

function remoteKey(collection: string): string {
	return `familyPantry:v2:${collection}:records`;
}

function asRemote<T extends object>(
	record: RecordEnvelope<T>,
): RecordEnvelope<T> {
	return {
		...record,
		meta: {
			...record.meta,
			dirty: false,
			source: "remote",
		},
	};
}

async function sheetsRequest<T>(
	action: "get" | "set",
	id: string,
	data?: T,
): Promise<T | null> {
	const response = await fetch(APP_DATA_URL, {
		method: "POST",
		body: JSON.stringify({
			secret: APP_DATA_SECRET,
			action,
			id,
			data,
		}),
	});

	if (!response.ok) {
		throw new Error(`Google Sheets request failed: ${response.status}`);
	}

	return (await response.json()) as T | null;
}

async function readRemote<T extends object>(
	collection: string,
): Promise<RecordEnvelope<T>[]> {
	const payload = await sheetsRequest<RemotePayload<T> | RecordEnvelope<T>[]>(
		"get",
		remoteKey(collection),
	);
	if (payload === null) return [];
	if (Array.isArray(payload)) return payload.map(asRemote);
	return (payload.records ?? []).map(asRemote);
}

async function writeRemote<T extends object>(
	collection: string,
	records: RecordEnvelope<T>[],
): Promise<void> {
	await sheetsRequest("set", remoteKey(collection), { records });
}

export function createGoogleSheetsSyncAdapter<T extends object>(
	collection: string,
): SyncAdapter<T> {
	return {
		async pull() {
			return { records: await readRemote<T>(collection) };
		},

		async push(mutations: Mutation<T>[]) {
			const current = new Map(
				(await readRemote<T>(collection)).map((record) => [record.id, record]),
			);
			const acked: string[] = [];
			const records: RecordEnvelope<T>[] = [];

			for (const mutation of mutations) {
				const authoritative = asRemote(mutation.record);
				current.set(mutation.recordId, authoritative);
				acked.push(mutation.mutationId);
				records.push(authoritative);
			}

			await writeRemote(collection, [...current.values()]);
			return { acked, records };
		},
	};
}
