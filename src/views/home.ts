import {
	APP_NAME,
	isUserCode,
	STORAGE_KEYS,
	setSignedInCode,
} from "../core/config";
import { icon } from "../core/helpers";
import type { RouteName } from "../core/types";
import { icons } from "../ui/icons";
import { destroyLayoutChrome } from "../ui/layout";
import type { Router, View } from "../ui/router";

export function createHomeView(router: Router): View {
	return {
		render() {
			destroyLayoutChrome();
			const code = localStorage.getItem(STORAGE_KEYS.userCode) ?? "";
			return `
				<section id="home-view" class="home-view">
					<div class="home-hero">
						<div class="home-logo">${icon(icons.food, 64)}</div>
						<h1 class="home-title">${APP_NAME}</h1>
						<p class="home-subtitle">Meal planning and more!</p>
					</div>
					<div class="home-card">
						<form id="codeForm" class="home-form">
							<div class="home-form__field">
								<label for="code" class="home-form__label">Enter your user code:</label>
								<input id="code" class="home-form__input" type="text" placeholder="e.g., AB1234" value="${code}" autocomplete="off" autocapitalize="characters" required />
							</div>
							<button type="submit" class="home-form__button"><span>Sign In</span>${icon(icons.arrowRight)}</button>
						</form>
					</div>
				</section>
			`;
		},
		onMount() {
			const form = document.getElementById("codeForm");
			const input = document.getElementById("code");
			if (
				!(form instanceof HTMLFormElement) ||
				!(input instanceof HTMLInputElement)
			)
				return;
			input.focus();
			form.addEventListener("submit", (event) => {
				event.preventDefault();
				const code = input.value.trim().toUpperCase();
				if (!isUserCode(code)) {
					showError(
						input,
						code ? `Code "${code}" not found` : "Please enter a code",
					);
					return;
				}
				localStorage.clear();
				setSignedInCode(code);
				void router.navigateTo("pantry" satisfies RouteName);
			});
			input.addEventListener("input", () => clearError(input));
		},
	};
}

function showError(input: HTMLInputElement, message: string): void {
	clearError(input);
	input.classList.add("error", "shake");
	const error = document.createElement("div");
	error.className = "home-form__error";
	error.textContent = message;
	input.parentElement?.append(error);
	window.setTimeout(() => input.classList.remove("shake"), 500);
}

function clearError(input: HTMLInputElement): void {
	input.classList.remove("error");
	input.parentElement?.querySelector(".home-form__error")?.remove();
}
