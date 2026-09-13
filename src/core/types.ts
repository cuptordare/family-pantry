export type UserCode = "SW1984" | "CW1985" | "CW2011" | "KW2015";

export interface UserProfile {
	code: UserCode;
	name: string;
	nickname: string;
}

export type PantryTab = "meals" | "supplies";
export type RouteName =
	| "home"
	| "pantry"
	| "store"
	| "todo"
	| "schedule"
	| "events";

export interface PantryData {
	dinnerWants: string[];
	dinnerMaybes: string[];
	dinnerNotWants: string[];
	lunchWants: string[];
	lunchMaybes: string[];
	lunchNotWants: string[];
	breakfastWants: string[];
	breakfastMaybes: string[];
	breakfastNotWants: string[];
	groceryWants: string[];
	otherWants: string[];
}

export interface PantryRecord {
	code: UserCode;
	data: PantryData;
}

export interface TodoRecord {
	items: string[];
}

export type DayName =
	| "monday"
	| "tuesday"
	| "wednesday"
	| "thursday"
	| "friday"
	| "saturday"
	| "sunday";

export interface ScheduleEvent {
	id: string;
	title: string;
	startTime: string;
	endTime: string;
}

export type ScheduleRecord = Record<DayName, ScheduleEvent[]>;

export interface CalendarEvent {
	id: string;
	title: string;
	/**
	 * Full ISO instant for timed events; "yyyy-MM-dd" (script-timezone local
	 * date, not UTC) for all-day events, so grouping/displaying by day never
	 * shifts a date across midnight due to a UTC/local mismatch.
	 */
	start: string;
	end: string;
	allDay: boolean;
	location?: string;
	description?: string;
}

export interface EventsRecord {
	events: CalendarEvent[];
}

export interface AppDataApi {
	ready(): Promise<void>;
	sync(): Promise<void>;
	subscribeSyncActivity(listener: (busy: boolean) => void): () => void;
	getPantryData(code: UserCode): Promise<PantryData>;
	subscribePantryData(
		code: UserCode,
		listener: (data: PantryData) => void,
	): () => void;
	savePantryData(code: UserCode, data: PantryData): Promise<void>;
	getAllPantryData(): Promise<Record<UserCode, PantryData>>;
	subscribeAllPantryData(
		listener: (data: Record<UserCode, PantryData>) => void,
	): () => void;
	saveAllPantryData(data: Record<UserCode, PantryData>): Promise<void>;
	getTodoList(): Promise<TodoRecord>;
	subscribeTodoList(listener: (data: TodoRecord) => void): () => void;
	saveTodoList(data: TodoRecord): Promise<void>;
	getSchedule(): Promise<ScheduleRecord>;
	subscribeSchedule(listener: (data: ScheduleRecord) => void): () => void;
	saveSchedule(data: ScheduleRecord): Promise<void>;
	getEvents(): Promise<CalendarEvent[]>;
	subscribeEvents(listener: (data: CalendarEvent[]) => void): () => void;
	clearCache(): Promise<void>;
}
