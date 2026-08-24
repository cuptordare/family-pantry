import { getSignedInCode, USER_CODES } from "../core/config";
import { icon, setError, setLoading } from "../core/helpers";
import type { AppDataApi, PantryData, UserCode } from "../core/types";
import { icons } from "../ui/icons";
import { titleBar } from "../ui/layout";
import type { Router, View } from "../ui/router";

type PantryKey = keyof PantryData;

interface StoreItem {
	name: string;
	wants: UserCode[];
	maybes: UserCode[];
}

export function createStoreView(data: AppDataApi, router: Router): View {
	let implementation: StoreViewImpl | null = null;
	return {
		render() {
			const code = getSignedInCode();
			if (!code) {
				void router.navigateTo("home");
				return "";
			}
			implementation = new StoreViewImpl(code, data, router);
			return `<section id="store-view" class="store-view"></section>`;
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

class StoreViewImpl {
	private state: Record<UserCode, PantryData> | null = null;
	private selected = new Set<string>();
	private unsubscribePantry: (() => void) | null = null;

	constructor(
		private readonly code: UserCode,
		private readonly data: AppDataApi,
		private readonly router: Router,
	) {}

	async init(): Promise<void> {
		setLoading(true);
		setError(null);
		try {
			await this.data.getAllPantryData();
			this.unsubscribePantry = this.data.subscribeAllPantryData((nextState) => {
				this.state = nextState;
				this.pruneSelectedItems();
				this.render();
			});
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
		const container = document.getElementById("store-view");
		if (!container || !this.state) return;
		container.replaceChildren();
		container.append(
			titleBar({
				code: this.code,
				currentView: "store",
				router: this.router,
				data: this.data,
				showViewIcons: true,
			}),
		);
		const content = document.createElement("div");
		content.className = "view-content";
		content.append(this.sections());
		container.append(content, this.purchasedButton());
	}

	private sections(): HTMLElement {
		const el = document.createElement("div");
		el.innerHTML = `
			${this.mealSection("Breakfast", "breakfastWants", "breakfastMaybes")}
			${this.mealSection("Lunch", "lunchWants", "lunchMaybes")}
			${this.mealSection("Dinner", "dinnerWants", "dinnerMaybes")}
			${this.supplySection("Grocery", "groceryWants")}
			${this.supplySection("Other", "otherWants")}
		`;
		el.addEventListener("change", (event) => {
			const checkbox = event.target;
			if (
				!(checkbox instanceof HTMLInputElement) ||
				checkbox.type !== "checkbox"
			)
				return;
			const item = checkbox.closest<HTMLElement>("[data-item]")?.dataset.item;
			if (!item) return;
			if (checkbox.checked) this.selected.add(item);
			else this.selected.delete(item);
			checkbox
				.closest(".store-item")
				?.classList.toggle("selected", checkbox.checked);
			this.updatePurchasedButton();
		});
		return el;
	}

	private mealSection(
		title: string,
		wantsKey: PantryKey,
		maybesKey: PantryKey,
	): string {
		const map = new Map<string, StoreItem>();
		for (const code of USER_CODES) {
			const userState = this.state?.[code];
			for (const item of userState?.[wantsKey] ?? []) {
				const entry = map.get(item) ?? { name: item, wants: [], maybes: [] };
				entry.wants.push(code);
				map.set(item, entry);
			}
			for (const item of userState?.[maybesKey] ?? []) {
				const entry = map.get(item) ?? { name: item, wants: [], maybes: [] };
				entry.maybes.push(code);
				map.set(item, entry);
			}
		}
		return this.section(title, icons.food, [...map.values()]);
	}

	private supplySection(title: string, wantsKey: PantryKey): string {
		const map = new Map<string, StoreItem>();
		for (const code of USER_CODES) {
			for (const item of this.state?.[code]?.[wantsKey] ?? []) {
				const entry = map.get(item) ?? { name: item, wants: [], maybes: [] };
				entry.wants.push(code);
				map.set(item, entry);
			}
		}
		return this.section(title, icons.store, [...map.values()]);
	}

	private section(title: string, iconPath: string, items: StoreItem[]): string {
		const sorted = items.sort((a, b) =>
			a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
		);
		const itemsHtml = sorted.length
			? sorted.map((item) => this.itemHtml(item)).join("")
			: '<div class="store-empty">No items</div>';
		return `
			<div class="store-section">
				<div class="wants-title">${icon(iconPath, 18)} ${title}</div>
				<div class="store-items">${itemsHtml}</div>
			</div>
		`;
	}

	private itemHtml(item: StoreItem): string {
		const isSelected = this.selected.has(item.name);
		const allCodes = [...new Set([...item.wants, ...item.maybes])];
		const type =
			item.wants.length && item.maybes.length
				? "Wants/Maybes"
				: item.wants.length
					? "Wants"
					: "Maybes";
		const users = allCodes
			.map((code) => (code === this.code ? "Me" : code.substring(0, 2)))
			.join(", ");
		return `
			<label class="store-item select-option ${isSelected ? "selected" : ""}" data-item="${item.name}">
				<input type="checkbox" ${isSelected ? "checked" : ""} />
				<span class="select-option-checkmark"></span>
				<span class="store-item__content select-option-content">
					<span class="store-item__name">${item.name}</span>
					<span class="store-item__users">${type}: ${users}</span>
				</span>
			</label>
		`;
	}

	private purchasedButton(): HTMLElement {
		const el = document.createElement("div");
		el.id = "purchased-btn-container";
		el.className = `purchased-btn-container ${this.selected.size ? "visible" : ""}`;
		el.innerHTML = `<button class="purchased-btn">${icon(icons.check)} Purchased (${this.selected.size})</button>`;
		el.querySelector("button")?.addEventListener(
			"click",
			() => void this.markPurchased(),
		);
		return el;
	}

	private updatePurchasedButton(): void {
		const container = document.getElementById("purchased-btn-container");
		container?.classList.toggle("visible", this.selected.size > 0);
		const button = container?.querySelector("button");
		if (button)
			button.innerHTML = `${icon(icons.check)} Purchased (${this.selected.size})`;
	}

	private pruneSelectedItems(): void {
		if (!this.state || this.selected.size === 0) return;
		const visibleItems = new Set<string>();
		const keys: PantryKey[] = [
			"dinnerWants",
			"dinnerMaybes",
			"lunchWants",
			"lunchMaybes",
			"breakfastWants",
			"breakfastMaybes",
			"groceryWants",
			"otherWants",
		];
		for (const code of USER_CODES) {
			for (const key of keys) {
				for (const item of this.state[code][key]) visibleItems.add(item);
			}
		}
		for (const item of [...this.selected]) {
			if (!visibleItems.has(item)) this.selected.delete(item);
		}
	}

	private async markPurchased(): Promise<void> {
		if (!this.state || this.selected.size === 0) return;
		const remove = [...this.selected];
		const keys: PantryKey[] = [
			"dinnerWants",
			"dinnerMaybes",
			"lunchWants",
			"lunchMaybes",
			"breakfastWants",
			"breakfastMaybes",
			"groceryWants",
			"otherWants",
		];
		for (const code of USER_CODES) {
			for (const key of keys) {
				this.state[code][key] = this.state[code][key].filter(
					(item) => !remove.includes(item),
				);
			}
		}
		await this.data.saveAllPantryData(this.state);
		this.selected.clear();
		this.render();
	}
}
