import { sortItems } from "../core/helpers";

export function openSelectionModal({
	initialSelection,
	knownOptions,
	onApply,
	onClose,
}: {
	initialSelection: string[];
	knownOptions: string[];
	onApply(selection: string[]): void | Promise<void>;
	onClose?(applied: boolean): void;
}): void {
	const modal = new SelectionModal(
		initialSelection,
		knownOptions,
		onApply,
		onClose,
	);
	modal.open();
}

class SelectionModal {
	private selection: string[];
	private searchText = "";
	private modal = document.createElement("div");
	private content = document.createElement("div");
	private searchInput = document.createElement("input");
	private optionsContainer: HTMLElement = document.createElement("div");
	private actionsContainer: HTMLElement = document.createElement("div");

	constructor(
		initialSelection: string[],
		private readonly knownOptions: string[],
		private readonly onApply: (selection: string[]) => void | Promise<void>,
		private readonly onClose?: (applied: boolean) => void,
	) {
		this.selection = [...initialSelection];
	}

	open(): void {
		this.modal.className = "modal selection-modal show";
		this.modal.innerHTML = `<div class="modal-shell top"><div class="modal-content"></div></div>`;
		this.content = this.modal.querySelector(".modal-content") ?? this.content;
		this.content.classList.add("selection-content");
		document.body.append(this.modal);
		this.render();
		requestAnimationFrame(() =>
			this.modal.querySelector(".modal-shell")?.classList.add("show"),
		);
	}

	private render(): void {
		this.content.replaceChildren();
		this.searchInput = document.createElement("input");
		this.searchInput.type = "search";
		this.searchInput.placeholder = "Search...";
		this.searchInput.value = this.searchText;
		this.searchInput.addEventListener("input", () => {
			this.searchText = this.searchInput.value;
			this.refreshChoices();
		});
		this.optionsContainer = this.buildOptions();
		this.actionsContainer = this.buildActions();
		this.content.append(
			this.searchInput,
			this.optionsContainer,
			this.actionsContainer,
		);
		this.searchInput.focus();
	}

	private refreshChoices(): void {
		const scrollTop = this.optionsContainer.scrollTop;
		const nextOptions = this.buildOptions();
		const nextActions = this.buildActions();
		this.optionsContainer.replaceWith(nextOptions);
		this.actionsContainer.replaceWith(nextActions);
		this.optionsContainer = nextOptions;
		this.actionsContainer = nextActions;
		this.optionsContainer.scrollTop = scrollTop;
	}

	private buildOptions(): HTMLElement {
		const optionsEl = document.createElement("div");
		optionsEl.className = "selection-options";
		const needle = this.searchText.trim().toLowerCase();
		let foundExact = false;
		const options = sortItems([
			...new Set([...this.knownOptions, ...this.selection]),
		]);

		for (const option of options) {
			if (needle && !option.toLowerCase().includes(needle)) continue;
			foundExact ||= needle === option.toLowerCase();
			const selected = this.selection.includes(option);
			const optionButton = document.createElement("button");
			optionButton.type = "button";
			optionButton.className = "select-option";
			optionButton.setAttribute("aria-pressed", String(selected));
			optionButton.innerHTML = `
				<span class="select-option-checkmark"></span>
				<span class="select-option-content">${option}</span>
			`;
			optionButton.addEventListener("click", () => {
				this.toggle(option, !this.selection.includes(option));
				this.refreshChoices();
			});
			optionsEl.append(optionButton);
		}

		if (needle && !foundExact) {
			const add = document.createElement("button");
			add.type = "button";
			add.className = "link-button";
			add.textContent = `+ Add Item: "${this.searchText.trim()}"`;
			add.addEventListener("click", () => {
				this.toggle(this.searchText.trim(), true);
				this.searchText = "";
				this.searchInput.value = "";
				this.refreshChoices();
				this.searchInput.focus();
			});
			optionsEl.append(add);
		}

		return optionsEl;
	}

	private buildActions(): HTMLElement {
		const actions = document.createElement("div");
		actions.className = "modal-actions";
		const apply = document.createElement("button");
		apply.textContent = `Apply (${this.selection.length} Selected)`;
		apply.addEventListener("click", async () => {
			await this.onApply(sortItems(this.selection));
			this.close(true);
		});
		const cancel = document.createElement("button");
		cancel.className = "secondary";
		cancel.textContent = "Cancel";
		cancel.addEventListener("click", () => this.close(false));
		actions.append(apply, cancel);
		return actions;
	}

	private toggle(item: string, selected: boolean): void {
		this.selection = this.selection.filter((value) => value !== item);
		if (selected) this.selection.push(item);
	}

	private close(applied = false): void {
		this.modal.querySelector(".modal-shell")?.classList.remove("show");
		window.setTimeout(() => {
			this.modal.remove();
			this.onClose?.(applied);
		}, 180);
	}
}
