import {
	type Collection,
	createIndexedDBAdapter,
	createLocalSyncApp,
	createNetworkStatus,
	createSyncEngine,
	type SyncEngine,
} from "localsync";
import { emptyPantryData, USER_CODES } from "./config";
import { createGoogleSheetsSyncAdapter } from "./googleSheetsSyncAdapter";
import type {
	AppDataApi,
	PantryData,
	PantryRecord,
	ScheduleRecord,
	TodoRecord,
	UserCode,
} from "./types";

const pantryId = (code: UserCode) => `pantry:${code}`;
const todoId = "todo:shared";
const scheduleId = "schedule:shared";
const pushDebounceMs = 900;
const backgroundSyncIntervalMs = 60 * 60 * 1000;

function emptyTodo(): TodoRecord {
	return { items: [] };
}

function emptySchedule(): ScheduleRecord {
	return {
		monday: [],
		tuesday: [],
		wednesday: [],
		thursday: [],
		friday: [],
		saturday: [],
		sunday: [],
	};
}

function clone<T>(value: T): T {
	return structuredClone(value);
}

function allPantrySnapshot(
	records: PantryRecord[],
): Record<UserCode, PantryData> {
	const result = {} as Record<UserCode, PantryData>;
	for (const code of USER_CODES) result[code] = emptyPantryData();
	for (const record of records) result[record.code] = clone(record.data);
	return result;
}

async function syncAll(engines: SyncEngine[]): Promise<void> {
	await Promise.all(
		engines.map((engine) =>
			engine.sync().catch((error: unknown) => {
				console.error("sync error", error);
			}),
		),
	);
}

export function createAppData(): AppDataApi {
	const activityListeners = new Set<(busy: boolean) => void>();
	const pendingPushes = new Set<number>();
	let pushTimer: ReturnType<typeof setTimeout> | undefined;
	let activePushes = 0;

	const isBusy = () => pendingPushes.size > 0 || activePushes > 0;
	const emitActivity = () => {
		const busy = isBusy();
		for (const listener of activityListeners) listener(busy);
	};
	const runPush = async (index: number): Promise<void> => {
		const engine = engines[index];
		if (!engine) return;
		activePushes += 1;
		emitActivity();
		try {
			await engine.push();
		} catch (error) {
			console.error("background sync error", error);
		} finally {
			activePushes -= 1;
			emitActivity();
		}
	};
	const schedulePush = (index: number): void => {
		pendingPushes.add(index);
		emitActivity();
		if (pushTimer !== undefined) window.clearTimeout(pushTimer);
		pushTimer = window.setTimeout(() => {
			const indexes = [...pendingPushes];
			pendingPushes.clear();
			pushTimer = undefined;
			emitActivity();
			for (const queuedIndex of indexes) void runPush(queuedIndex);
		}, pushDebounceMs);
	};
	const runTrackedSync = async (): Promise<void> => {
		activePushes += 1;
		emitActivity();
		try {
			await syncAll(engines);
		} finally {
			activePushes -= 1;
			emitActivity();
		}
	};

	const app = createLocalSyncApp({
		storage: createIndexedDBAdapter({ databaseName: "family-pantry-v2" }),
		onError(error) {
			console.error("Local Sync persistence error", error);
		},
	});

	const pantry = app.collection<PantryRecord>("pantry");
	const todo = app.collection<TodoRecord>("todo");
	const schedule = app.collection<ScheduleRecord>("schedule");
	const network = createNetworkStatus();
	const engines = [
		createSyncEngine({
			collection: pantry,
			adapter: createGoogleSheetsSyncAdapter<PantryRecord>("pantry"),
			network,
			purgeDeletedOnPush: true,
		}),
		createSyncEngine({
			collection: todo,
			adapter: createGoogleSheetsSyncAdapter<TodoRecord>("todo"),
			network,
			purgeDeletedOnPush: true,
		}),
		createSyncEngine({
			collection: schedule,
			adapter: createGoogleSheetsSyncAdapter<ScheduleRecord>("schedule"),
			network,
			purgeDeletedOnPush: true,
		}),
	];

	const initPromise = initialize({
		appReady: app.ready(),
		pantry,
		todo,
		schedule,
		engines,
	});
	void initPromise.then(runTrackedSync);

	return {
		async ready() {
			await initPromise;
		},

		async sync() {
			await initPromise;
			await runTrackedSync();
		},

		subscribeSyncActivity(listener) {
			activityListeners.add(listener);
			listener(isBusy());
			return () => {
				activityListeners.delete(listener);
			};
		},

		async getPantryData(code) {
			await initPromise;
			return clone(pantry.peek(pantryId(code))?.data.data ?? emptyPantryData());
		},

		subscribePantryData(code, listener) {
			const query = pantry.get(pantryId(code));
			const snapshot = () =>
				clone(query.getCurrentResult()?.data.data ?? emptyPantryData());
			const unsubscribe = query.subscribe((record) => {
				listener(clone(record?.data.data ?? emptyPantryData()));
			});
			listener(snapshot());
			return unsubscribe;
		},

		async savePantryData(code, data) {
			await initPromise;
			pantry.replace(pantryId(code), { code, data: clone(data) });
			schedulePush(0);
		},

		async getAllPantryData() {
			await initPromise;
			const result = {} as Record<UserCode, PantryData>;
			for (const code of USER_CODES) {
				result[code] = clone(
					pantry.peek(pantryId(code))?.data.data ?? emptyPantryData(),
				);
			}
			return result;
		},

		subscribeAllPantryData(listener) {
			const query = pantry.query();
			const read = () =>
				allPantrySnapshot(
					query.getCurrentResult().map((record) => record.data),
				);
			const unsubscribe = query.subscribe((records) => {
				listener(allPantrySnapshot(records.map((record) => record.data)));
			});
			listener(read());
			return unsubscribe;
		},

		async saveAllPantryData(data) {
			await initPromise;
			for (const code of USER_CODES) {
				pantry.replace(pantryId(code), { code, data: clone(data[code]) });
			}
			schedulePush(0);
		},

		async getTodoList() {
			await initPromise;
			return clone(todo.peek(todoId)?.data ?? emptyTodo());
		},

		subscribeTodoList(listener) {
			const query = todo.get(todoId);
			const unsubscribe = query.subscribe((record) => {
				listener(clone(record?.data ?? emptyTodo()));
			});
			listener(clone(query.getCurrentResult()?.data ?? emptyTodo()));
			return unsubscribe;
		},

		async saveTodoList(data) {
			await initPromise;
			todo.replace(todoId, clone(data));
			schedulePush(1);
		},

		async getSchedule() {
			await initPromise;
			return clone(schedule.peek(scheduleId)?.data ?? emptySchedule());
		},

		subscribeSchedule(listener) {
			const query = schedule.get(scheduleId);
			const snapshot = () =>
				clone(query.getCurrentResult()?.data ?? emptySchedule());
			const unsubscribe = query.subscribe((record) => {
				listener(clone(record?.data ?? emptySchedule()));
			});
			listener(snapshot());
			return unsubscribe;
		},

		async saveSchedule(data) {
			await initPromise;
			schedule.replace(scheduleId, clone(data));
			schedulePush(2);
		},

		async clearCache() {
			await initPromise;
			await runTrackedSync();
		},
	};
}

async function initialize({
	appReady,
	pantry,
	todo,
	schedule,
	engines,
}: {
	appReady: Promise<void>;
	pantry: Collection<PantryRecord>;
	todo: Collection<TodoRecord>;
	schedule: Collection<ScheduleRecord>;
	engines: SyncEngine[];
}): Promise<void> {
	await appReady;

	const insertedDefaults: Array<{
		collection: Collection<object>;
		id: string;
	}> = [];
	for (const code of USER_CODES) {
		const id = pantryId(code);
		if (!pantry.peek(id)) {
			pantry.insert({ code, data: emptyPantryData() }, { id });
			insertedDefaults.push({
				collection: pantry as unknown as Collection<object>,
				id,
			});
		}
	}

	if (!todo.peek(todoId)) {
		todo.insert(emptyTodo(), { id: todoId });
		insertedDefaults.push({
			collection: todo as unknown as Collection<object>,
			id: todoId,
		});
	}

	if (!schedule.peek(scheduleId)) {
		schedule.insert(emptySchedule(), { id: scheduleId });
		insertedDefaults.push({
			collection: schedule as unknown as Collection<object>,
			id: scheduleId,
		});
	}

	for (const defaultRecord of insertedDefaults) {
		defaultRecord.collection.markSynced([defaultRecord.id]);
	}

	for (const engine of engines) {
		engine.start({ intervalMs: backgroundSyncIntervalMs });
	}
}
