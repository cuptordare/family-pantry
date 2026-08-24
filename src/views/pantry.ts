import { getPantryTab, getSignedInCode, setPantryTab } from "../core/config";
import { icon, setError, setLoading, sortItems } from "../core/helpers";
import {
	breakfastOptions,
	dinnerOptions,
	groceryOptions,
	lunchOptions,
	otherOptions,
} from "../core/options";
import type {
	AppDataApi,
	PantryData,
	PantryTab,
	UserCode,
} from "../core/types";
import { icons } from "../ui/icons";
import { titleBar } from "../ui/layout";
import type { Router, View } from "../ui/router";
import { openSelectionModal } from "../ui/selectionModal";

type PantryKey = keyof PantryData;

const contexts: Record<PantryKey, { others: PantryKey[]; options: string[] }> =
	{
		groceryWants: { others: [], options: groceryOptions },
		otherWants: { others: [], options: otherOptions },
		dinnerWants: {
			others: ["dinnerMaybes", "dinnerNotWants"],
			options: dinnerOptions,
		},
		dinnerMaybes: {
			others: ["dinnerWants", "dinnerNotWants"],
			options: dinnerOptions,
		},
		dinnerNotWants: {
			others: ["dinnerWants", "dinnerMaybes"],
			options: dinnerOptions,
		},
		breakfastWants: {
			others: ["breakfastMaybes", "breakfastNotWants"],
			options: breakfastOptions,
		},
		breakfastMaybes: {
			others: ["breakfastWants", "breakfastNotWants"],
			options: breakfastOptions,
		},
		breakfastNotWants: {
			others: ["breakfastWants", "breakfastMaybes"],
			options: breakfastOptions,
		},
		lunchWants: {
			others: ["lunchMaybes", "lunchNotWants"],
			options: lunchOptions,
		},
		lunchMaybes: {
			others: ["lunchWants", "lunchNotWants"],
			options: lunchOptions,
		},
		lunchNotWants: {
			others: ["lunchWants", "lunchMaybes"],
			options: lunchOptions,
		},
	};

export function createPantryView(data: AppDataApi, router: Router): View {
	let implementation: PantryViewImpl | null = null;
	return {
		render() {
			const code = getSignedInCode();
			if (!code) {
				void router.navigateTo("home");
				return "";
			}
			implementation = new PantryViewImpl(code, data, router);
			return `<section id="pantry-view" class="pantry-view"></section>`;
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

class PantryViewImpl {
	private state: PantryData | null = null;
	private pendingSyncedState: PantryData | null = null;
	private selectionInProgress = false;
	private unsubscribePantry: (() => void) | null = null;
	private activeTab: PantryTab;

	constructor(
		private readonly code: UserCode,
		private readonly data: AppDataApi,
		private readonly router: Router,
	) {
		this.activeTab = getPantryTab(code);
	}

	async init(): Promise<void> {
		setLoading(true);
		setError(null);
		try {
			await this.data.getPantryData(this.code);
			this.unsubscribePantry = this.data.subscribePantryData(
				this.code,
				(nextState) => {
					if (this.selectionInProgress) {
						this.pendingSyncedState = nextState;
						return;
					}
					this.state = nextState;
					this.render();
				},
			);
		} catch {
			setError("load-pantry-data");
		} finally {
			setLoading(false);
		}
	}

	destroy(): void {
		this.unsubscribePantry?.();
		this.unsubscribePantry = null;
		setLoading(false);
		setError(null);
	}

	private render(): void {
		const container = document.getElementById("pantry-view");
		if (!container || !this.state) return;
		container.replaceChildren();
		container.append(
			titleBar({
				code: this.code,
				currentView: "pantry",
				router: this.router,
				data: this.data,
				showViewIcons: true,
			}),
		);
		const content = document.createElement("div");
		content.className = "view-content";
		content.append(
			this.activeTab === "meals" ? this.mealsContent() : this.suppliesContent(),
		);
		container.append(content, this.bottomMenu());
	}

	private bottomMenu(): HTMLElement {
		const nav = document.createElement("nav");
		nav.className = "bottom-menu";
		nav.innerHTML = `
			<button class="menu-tab ${this.activeTab === "meals" ? "menu-tab--active" : ""}" data-tab="meals">${icon(icons.food)}<span>Meals</span></button>
			<button class="menu-tab ${this.activeTab === "supplies" ? "menu-tab--active" : ""}" data-tab="supplies">${icon(icons.list)}<span>Supplies</span></button>
		`;
		nav.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const tab = target.closest<HTMLElement>("[data-tab]")?.dataset.tab as
				| PantryTab
				| undefined;
			if (!tab) return;
			this.activeTab = tab;
			setPantryTab(this.code, tab);
			this.render();
		});
		return nav;
	}

	private mealsContent(): HTMLElement {
		return this.section(`
			${this.title("Breakfast", icons.food)}
			${this.card("Wants", "breakfastWants")}
			${this.card("Maybes", "breakfastMaybes")}
			${this.card("Not Wants", "breakfastNotWants")}
			${this.title("Lunch", icons.store)}
			${this.card("Wants", "lunchWants")}
			${this.card("Maybes", "lunchMaybes")}
			${this.card("Not Wants", "lunchNotWants")}
			${this.title("Dinner", icons.food)}
			${this.card("Wants", "dinnerWants")}
			${this.card("Maybes", "dinnerMaybes")}
			${this.card("Not Wants", "dinnerNotWants")}
		`);
	}

	private suppliesContent(): HTMLElement {
		return this.section(`
			${this.title("Groceries", icons.store)}
			${this.card("Wants", "groceryWants")}
			${this.title("Other", icons.list)}
			${this.card("Wants", "otherWants")}
		`);
	}

	private section(html: string): HTMLElement {
		const el = document.createElement("div");
		el.innerHTML = html;
		el.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const key = target.closest<HTMLElement>("[data-edit-action]")?.dataset
				.editAction as PantryKey | undefined;
			if (key) this.showSelection(key);
		});
		return el;
	}

	private title(text: string, iconPath: string): string {
		return `<div class="wants-title">${icon(iconPath, 18)} ${text}</div>`;
	}

	private card(title: string, key: PantryKey): string {
		const list = this.state?.[key] ?? [];
		const text = list.length
			? sortItems(list).join(", ")
			: '<span class="muted-italic">None</span>';
		return `
			<div class="wants-card">
				<div class="wants-card__body">
					<div class="wants-card__title">${title}</div>
					<div class="wants-card__list">${text}</div>
				</div>
				<div class="wants-card__actions">
					<button data-edit-action="${key}" title="Edit" class="button--icon-only">${icon(icons.edit)}</button>
				</div>
			</div>
		`;
	}

	private showSelection(key: PantryKey): void {
		if (!this.state) return;
		const context = contexts[key];
		this.selectionInProgress = true;
		openSelectionModal({
			initialSelection: this.state[key],
			knownOptions: context.options,
			onApply: async (selection) => {
				const nextState = this.pendingSyncedState ?? this.state;
				if (!nextState) return;
				nextState[key] = selection;
				for (const other of context.others) {
					nextState[other] = nextState[other].filter(
						(item) => !selection.includes(item),
					);
				}
				this.state = nextState;
				this.pendingSyncedState = null;
				this.selectionInProgress = false;
				await this.data.savePantryData(this.code, nextState);
				this.render();
			},
			onClose: (applied) => {
				if (applied) return;
				this.selectionInProgress = false;
				if (!this.pendingSyncedState) return;
				this.state = this.pendingSyncedState;
				this.pendingSyncedState = null;
				this.render();
			},
		});
	}
}
