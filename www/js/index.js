import { Router } from '@vaadin/router';
import { App } from '@capacitor/app';
import "./views/bridges.js";
import "./views/bridge.js";

window.addEventListener('load', () => { 
    initRouter();

    /* Capacitor default back button behavior just closes the app.
       This will make it act like a regular web app instead. */
    App.addListener("backButton",() => {
        window.history.back();
    });
});

function initRouter() {
    const router = new Router(document.querySelector('router-outlet')); 
    router.setRoutes([
        {
            path: '/',
            component: 'bridge-list'
        },
        {
            path: '/bridges/:bridge',
            component: 'light-list'
        }
    ]);
}
