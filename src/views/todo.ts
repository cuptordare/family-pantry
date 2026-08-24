import { getSignedInCode } from "../core/config";
import { icon, setError, setLoading, titleCase } from "../core/helpers";
import type { AppDataApi, TodoRecord, UserCode } from "../core/types";
import { icons } from "../ui/icons";
import { titleBar } from "../ui/layout";
import type { Router, View } from "../ui/router";

export function createTodoView(data: AppDataApi, router: Router): View {
	let implementation: TodoViewImpl | null = null;
	return {
		render() {
			const code = getSignedInCode();
			if (!code) {
				void router.navigateTo("home");
				return "";
			}
			implementation = new TodoViewImpl(code, data, router);
			return `<section id="todo-view" class="todo-view"></section>`;
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

class TodoViewImpl {
	private state: TodoRecord = { items: [] };
	private todoDraft = "";
	private unsubscribeTodo: (() => void) | null = null;
	private dragFrom: number | null = null;
	private touchDrag: {
		from: number;
		element: HTMLElement;
		startY: number;
		currentY: number;
	} | null = null;

	constructor(
		private readonly code: UserCode,
		private readonly data: AppDataApi,
		private readonly router: Router,
	) {}

	async init(): Promise<void> {
		setLoading(true);
		setError(null);
		try {
			await this.data.getTodoList();
			this.unsubscribeTodo = this.data.subscribeTodoList((nextState) => {
				this.state = nextState;
				this.render();
			});
		} catch {
			setError("load-todo-data");
		} finally {
			setLoading(false);
		}
	}

	destroy(): void {
		this.unsubscribeTodo?.();
		this.unsubscribeTodo = null;
		setLoading(false);
		setError(null);
	}

	private render(): void {
		const container = document.getElementById("todo-view");
		if (!container) return;
		const todoInputWasFocused = document.activeElement?.id === "todoInput";
		container.replaceChildren();
		container.append(
			titleBar({
				code: this.code,
				currentView: "todo",
				router: this.router,
				data: this.data,
			}),
		);
		const content = document.createElement("div");
		content.className = "view-content";
		content.append(this.form(), this.list());
		container.append(content);
		if (todoInputWasFocused) {
			const input = document.getElementById("todoInput");
			if (input instanceof HTMLInputElement) {
				input.focus();
				input.setSelectionRange(input.value.length, input.value.length);
			}
		}
	}

	private form(): HTMLElement {
		const el = document.createElement("div");
		el.className = "todo-add";
		el.innerHTML = `<input id="todoInput" type="text" placeholder="Add new item..." autocomplete="off" /><button id="todoAddBtn">Add</button>`;
		const input = el.querySelector<HTMLInputElement>("input");
		if (input) input.value = this.todoDraft;
		const add = () => {
			const text = titleCase(this.todoDraft);
			if (!text || this.state.items.includes(text)) return;
			this.state.items.push(text);
			this.todoDraft = "";
			if (input) input.value = this.todoDraft;
			void this.save();
		};
		input?.addEventListener("input", () => {
			this.todoDraft = input.value;
		});
		el.querySelector("button")?.addEventListener("click", add);
		input?.addEventListener("keydown", (event) => {
			if (event.key === "Enter") add();
		});
		return el;
	}

	private list(): HTMLElement {
		const el = document.createElement("div");
		el.id = "todoList";
		el.className = "todo-list";
		if (!this.state.items.length) {
			el.innerHTML = `<div class="todo-empty">No items yet. Add one above!</div>`;
			return el;
		}
		for (const [index, item] of this.state.items.entries()) {
			el.append(this.item(item, index));
		}
		return el;
	}

	private item(item: string, index: number): HTMLElement {
		const el = document.createElement("div");
		el.className = "todo-item";
		el.draggable = true;
		el.dataset.index = String(index);
		el.innerHTML = `
			<span class="todo-item__handle button--icon-only">${icon(icons.grip, 20)}</span>
			<span class="todo-item__text">${item}</span>
			<button class="button--icon-only" data-delete="${index}" title="Remove">${icon(icons.delete)}</button>
		`;
		el.addEventListener("dragstart", () => {
			this.dragFrom = index;
			el.classList.add("dragging");
		});
		el.addEventListener("dragover", (event) => event.preventDefault());
		el.addEventListener("drop", (event) => {
			event.preventDefault();
			if (this.dragFrom !== null) void this.move(this.dragFrom, index);
		});
		el.addEventListener("dragend", () => {
			this.dragFrom = null;
			el.classList.remove("dragging");
		});
		el.querySelector("[data-delete]")?.addEventListener("click", () => {
			this.state.items.splice(index, 1);
			void this.save();
		});
		const handle = el.querySelector(".todo-item__handle");
		handle?.addEventListener(
			"touchstart",
			(event) => this.touchStart(event, el, index),
			{ passive: false },
		);
		handle?.addEventListener("touchmove", (event) => this.touchMove(event), {
			passive: false,
		});
		handle?.addEventListener("touchend", () => this.touchEnd());
		return el;
	}

	private touchStart(event: Event, element: HTMLElement, index: number): void {
		const touch = (event as TouchEvent).touches[0];
		if (!touch) return;
		event.preventDefault();
		this.touchDrag = {
			from: index,
			element,
			startY: touch.clientY,
			currentY: touch.clientY,
		};
		element.classList.add("dragging");
	}

	private touchMove(event: Event): void {
		if (!this.touchDrag) return;
		const touch = (event as TouchEvent).touches[0];
		if (!touch) return;
		event.preventDefault();
		this.touchDrag.currentY = touch.clientY;
		this.touchDrag.element.style.transform = `translateY(${touch.clientY - this.touchDrag.startY}px)`;
	}

	private touchEnd(): void {
		if (!this.touchDrag) return;
		const { from, currentY, element } = this.touchDrag;
		const items = [
			...document.querySelectorAll<HTMLElement>(".todo-item:not(.dragging)"),
		];
		let to = from;
		for (const item of items) {
			const rect = item.getBoundingClientRect();
			const index = Number(item.dataset.index ?? from);
			if (currentY < rect.top + rect.height / 2) {
				to = index > from ? index - 1 : index;
				break;
			}
			to = index >= from ? index : index + 1;
		}
		element.classList.remove("dragging");
		element.style.transform = "";
		this.touchDrag = null;
		if (from !== to) void this.move(from, to);
	}

	private async move(from: number, to: number): Promise<void> {
		const [item] = this.state.items.splice(from, 1);
		if (item === undefined) return;
		this.state.items.splice(to, 0, item);
		await this.save();
	}

	private async save(): Promise<void> {
		await this.data.saveTodoList(this.state);
		this.render();
	}
}
