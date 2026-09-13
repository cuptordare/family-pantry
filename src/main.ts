import { createAppData } from "./core/data";
import { byId } from "./core/helpers";
import type { RouteName } from "./core/types";
import { Router, type View } from "./ui/router";
import { createEventsView } from "./views/events";
import { createHomeView } from "./views/home";
import { createPantryView } from "./views/pantry";
import { createScheduleView } from "./views/schedule";
import { createStoreView } from "./views/store";
import { createTodoView } from "./views/todo";

const data = createAppData();
const appEl = byId("app");
const routes = {} as Record<RouteName, View>;
const router = new Router(appEl, routes);

routes.home = createHomeView(router);
routes.pantry = createPantryView(data, router);
routes.store = createStoreView(data, router);
routes.todo = createTodoView(data, router);
routes.schedule = createScheduleView(data, router);
routes.events = createEventsView(data, router);

router.init();

if ("serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		void navigator.serviceWorker.register("./sw.js");
	});
}
