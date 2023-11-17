import {LitElement, html} from 'lit';
import {live} from 'lit/directives/live.js';
import {Router} from '@vaadin/router';

import * as Philips from '../api/philips.js';

export class BridgeList extends LitElement { 
    static get properties() {
        return {
            bridges: {type: Array},
            isDeviceReady: {type: Boolean}
        }
    }

    constructor() {
        super();
        this.bridges = [];

        this.getBridges();

        this.addEventListener("new-bridge",(e) => {
            this.addBridge(e.detail);
        });
    }

    getBridges() {
        Philips.getStoredAccounts().forEach((bridge) => {
            this.addBridge(bridge);
        });
        /* Needs to be adapted from Cordova */
        // Philips.scanForBridges();
    }

    addBridge(data) {
        if (!this.bridges.find((b) => b.ip === data.ip)) {
            this.bridges = [...this.bridges,data];
        }
    }

    openAddDialog() {
        this.renderRoot.querySelector("add-bridge-dialog").openDialog();
    }

    async bridgeClicked(e) {
        let index = e.currentTarget.getAttribute("key");
        let bridge = this.bridges[index];

        if (typeof bridge.account !== "string" || bridge.account.trim().length <= 0) {
            this.createBridgeAccount(bridge);
        }
        else {
            this.navigateToAccount(index);
        }
    }

    async createBridgeAccount(bridge) {
        let dialog = this.renderRoot.querySelector("connect-bridge-dialog");
        try {
            dialog.openDialog();
            await Philips.detectBridge('http://' + bridge.ip + '/description.xml');
            dialog.instruction = "Please go and press the connect button on your Hue bridge.";
            await Philips.postAccount(bridge);
            dialog.updateSuccess();

            // Set the array to a copy of itself so the screen updates.
            this.bridges = [...this.bridges];
            //this.navigateToAccount(bridge);
            this.navigateToAccount(this.bridges.length-1);
        } catch (error) {
            dialog.updateError(error.message);
        }
    }

    navigateToAccount(index) {
        Router.go("/bridges/" + index);
    }

    createRenderRoot() {
        return this;
    }

    render() {
        return html`
        <div class="flex space-x-4 relative">
            <!--<div class="text-xl">List Header</div>-->
            <div class="absolute right-4 top-1">
                <button @click="${this.openAddDialog}" class="border-2 rounded-full p-2 bg-purple-200 w-[48px] h-[48px]"> 
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        </div>
        <ol id="bridge-list" class="px-4">
            ${this.bridges.map((bridge,index) => {
                return html`
                    <li key=${index} class="flex items-center space-x-4 py-2 hover:bg-slate-200 hover:cursor-pointer active:bg-slate-400" @click="${this.bridgeClicked}">
                        <div>
                            <i class="text-xl fas 
                                ${(typeof bridge.account === "string" && bridge.account.trim().length > 0) ?  "text-green-500 fa-check-circle" : "text-blue-500 fa-question-circle"}
                            "></i>
                        </div>
                        <div>
                            <div class="font-sans text-xl font-semibold">${bridge.ip}</div>
                            <div class="font-sans text-medium font-normal text-slate-600">${bridge.name}</div>
                        </div>
                    </li>    
                    <hr>          
                    `;
            })}
        </ol>
        <add-bridge-dialog></add-bridge-dialog> 
        <connect-bridge-dialog></connect-bridge-dialog>
        `;
    }
}

export class AddBridgeDialog extends LitElement {
    static get properties() {
        return {
            form: {type: Object}
        }
    }

    constructor() {
        super();
        this.form = {
            ip: ""
        }

        this.addEventListener("click", async (e) => {
            switch (e.target.id) {
                case "add-bridge-ok":
                    e.preventDefault();
                    await this.validateForm(e);
                    break;
                case "add-bridge-cancel":
                    e.preventDefault();
                    this.closeDialog("");
            }
        });

        this.addEventListener("keydown", (e) => {
            switch (e.target.id) {
                case "add-bridge-ip":
                    e.target.setCustomValidity("");
            }
        });

        /* This could be used to pick up all changes in an input form. */
        this.addEventListener("change", (e) => {
            console.log(e);
        });
    }

    /*
    async firstUpdated() {
        let dialog = this.renderRoot.querySelector("#add-bridge-dialog");
        dialog.addEventListener("close",(e) => {
            if (dialog.returnValue === "OK") {
                this.dispatchEvent(new CustomEvent("new-bridge",{
                    detail: {
                        ip: this.form.ip,
                        name: "Hue Bridge"
                    },
                    bubbles: true
                }));
            }
        });
    }
    */

    openDialog() {
        this.resetForm();
        this.renderRoot.querySelector("#add-bridge-dialog").showModal();
    }

    closeDialog(value) {
        this.renderRoot.querySelector("#add-bridge-dialog").close(value);
    }

    resetForm() {
        this.form = {
            ip: ""
        };
        this.renderRoot.querySelector("#add-bridge-ip").setCustomValidity("");
    }

    async validateForm(e) {
        var ip = this.renderRoot.querySelector("#add-bridge-ip");

        // Capture the entered value in the component properties.
        this.form = {
            ip: ip.value
        }

        if (ip.validity.valid) { // Browser has already done the default validations.
            // Add custom validations beyond what the browser does.
            let isError = false;

            // ip.setCustomValidity("My error message here.") <- Turn on error message.
            // ip.setCustomValidity("") <- Turn off error message.

            if (ip.value.trim().length === 0) {
                ip.setCustomValidity("Enter an IP address.");
                isError = true;
            }
            else {
                try {
                    this.form.uuid = await Philips.detectBridge("http://" + ip.value + "/description.xml");
                } catch(error) {
                    ip.setCustomValidity("Unable to connect to this address.");
                    isError = true;
                }
            }
            
            if (!isError) {
                ip.setCustomValidity("");
                this.closeDialog("OK");
                this.dispatchEvent(new CustomEvent("new-bridge",{
                    detail: {
                        ip: this.form.ip,
                        uuid: this.form.uuid,
                        name: "Hue Bridge"
                    },
                    bubbles: true
                }));
                return;
            }
        }

        this.renderRoot.querySelector("#add-bridge-form").reportValidity();
        
        /* This will stop the form from doing the default browser validation messages. */
        //e.preventDefault();
    }

    createRenderRoot() {
        return this;
    }

    render() {
        return html`
        <dialog id="add-bridge-dialog" class="py-3 px-4 rounded-lg sm:w-4/5 sm:max-w-sm w-screen sm:my-auto mt-3 mx-auto">
            <h3 class="font-semibold text-gray-900">Add Hue Bridge</h3>
            <form id="add-bridge-form" method="dialog">
                <div class="w-full flex flex-col mt-4">
                    <label for="add-bridge-ip" class="text-sm font-medium text-gray-900 leading-6">IP address of bridge:</label>
                    <input type="text" 
                           id="add-bridge-ip" 
                           placeholder="0.0.0.0" 
                           pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
                           class="w-full mt-1 rounded-md border-0 ring-1 ring-inset ring-gray-300 
                                  focus:ring-2 focus:ring-inset focus:ring-indigo-200 py-1 px-2 sm:text-sm sm:leading-6
                                  invalid:ring-pink-500 invalid:text-pink-600 focus:invalid:ring-pink-500 focus:invalid:text-pink-600
                                 "
                           .value="${live(this.form.ip)}"
                    >
                </div>
                <div class="w-full flex flex-row-reverse mt-4">
                    <button id="add-bridge-ok" value="OK" class="inline-flex rounded-md bg-blue-600 text-white px-2 py-1 text-sm hover:bg-blue-500">Add</button>
                    <button id="add-bridge-cancel" class="inline-flex rounded-md mr-2 bg-gray-200 text-black px-2 py-1 text-sm hover:bg-gray-100">Cancel</button>
                </div>
            </form>
        </dialog>        
        `
    }
}

export class ConnectBridgeDialog extends LitElement {
    static get properties() {
        return {
            isError: {type: Boolean},
            instruction: {type: String},
            message: {type: String}
        }
    }

    constructor() {
        super();
        this.isError = false;
        this.instruction = "Detecting bridge...";
        this.message = "";
    }

    openDialog() {
        this.isError = false;
        this.message = "";
        this.renderRoot.querySelector("#connect-bridge-dialog").showModal();
    }

    closeDialog() {
        this.renderRoot.querySelector("#connect-bridge-dialog").close();
    }

    updateSuccess() {
        this.closeDialog();
    }

    updateError(message) {
        this.message = message;
        this.isError = true;
    }

    createRenderRoot() {
        return this;
    }

    render() {
        return html`
        <dialog id="connect-bridge-dialog" 
                class="py-3 px-4 rounded-lg sm:w-4/5 sm:max-w-sm w-screen sm:my-auto mt-3 mx-auto">
            <h3 class="font-semibold text-gray-900">Connecting to Bridge</h3>
            <div class="w-full flex flex-col mt-4">
                <p class="text-sm font-medium leading-6
                          ${(this.isError) ? "collapse" : "visible"}
                ">
                    ${this.instruction}
                </p>
                <p class="text-sm font-medium leading-6 text-pink-600
                         ${(this.isError) ? "visible" : "collapse"}
                ">
                    An error has occurred while connecting to the Hue bridge:
                </p>
                <p class="text-sm font-medium leading-6
                         ${(this.isError) ? "visible" : "collapse"}
                ">
                    ${this.message}
                </p>
            </div>
            <div class="w-full flex flex-row-reverse mt-4">
                <button id="connect-bridge-cancel" 
                        class="inline-flex rounded-md mr-2 bg-gray-200 text-black px-2 py-1 text-sm hover:bg-gray-100"
                        @click=${this.closeDialog}>
                    Cancel
                </button>
            </div>
        </dialog>
        `
    }
}

customElements.define('bridge-list',BridgeList);
customElements.define('add-bridge-dialog',AddBridgeDialog);
customElements.define('connect-bridge-dialog',ConnectBridgeDialog);
