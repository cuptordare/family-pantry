import type {
	DayName,
	PantryData,
	PantryTab,
	UserCode,
	UserProfile,
} from "./types";

export const APP_NAME = "Family Pantry";
export const APP_SHORT_NAME = "FP";

export const STORAGE_KEYS = {
	userCode: "familyPantry:user:v2",
	pantryTab: "familyPantry:pantry:{code}:tab:v2",
};

export const USERS = [
	{ code: "SW1984", name: "Scott Wicker", nickname: "Dad" },
	{ code: "CW1985", name: "Christy Wicker", nickname: "Mom" },
	{ code: "CW2011", name: "Cole Wicker", nickname: "Cole Monster" },
	{ code: "KW2015", name: "Kaylie Wicker", nickname: "K-Bug" },
] as const satisfies readonly UserProfile[];

export const USER_CODES = USERS.map((user) => user.code) as UserCode[];

export const DAYS = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
] as const satisfies readonly DayName[];

export const DAY_LABELS: Record<DayName, string> = {
	monday: "Monday",
	tuesday: "Tuesday",
	wednesday: "Wednesday",
	thursday: "Thursday",
	friday: "Friday",
	saturday: "Saturday",
	sunday: "Sunday",
};

export function getUserByCode(code: string | null): UserProfile | undefined {
	return USERS.find((user) => user.code === code);
}

export function isUserCode(code: string | null): code is UserCode {
	return USER_CODES.includes(code as UserCode);
}

export function getSignedInCode(): UserCode | null {
	const code = localStorage.getItem(STORAGE_KEYS.userCode);
	return isUserCode(code) ? code : null;
}

export function setSignedInCode(code: UserCode): void {
	localStorage.setItem(STORAGE_KEYS.userCode, code);
}

export function getPantryTab(code: UserCode): PantryTab {
	const key = STORAGE_KEYS.pantryTab.replace("{code}", code);
	const tab = localStorage.getItem(key);
	return tab === "supplies" ? "supplies" : "meals";
}

export function setPantryTab(code: UserCode, tab: PantryTab): void {
	const key = STORAGE_KEYS.pantryTab.replace("{code}", code);
	localStorage.setItem(key, tab);
}

export function emptyPantryData(): PantryData {
	return {
		dinnerWants: [],
		dinnerMaybes: [],
		dinnerNotWants: [],
		lunchWants: [],
		lunchMaybes: [],
		lunchNotWants: [],
		breakfastWants: [],
		breakfastMaybes: [],
		breakfastNotWants: [],
		groceryWants: [],
		otherWants: [],
	};
}
