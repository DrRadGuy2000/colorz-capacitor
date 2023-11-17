import {LitElement, html} from 'lit';
import * as Philips from "../api/philips.js";

export class LightList extends LitElement {
    static get properties() {
        return {
            lights: {type: Array},
            location: {type: String},
            bridge: {type: Object}
        };
    }

    constructor() {
        super();
        this.bridge = {};
        this.location = "";
        this.lights = [];
        /*
        this.lights = [
            {
                state: {
                    id: "1",
                    on: false,
                    bri: 57,
                    hue: 8632,
                    sat: 117
                },
                type: "Extended color light",
                name: "Living room end table"
            }
        ];
        */
        this.addEventListener("color-changed",(e) => {
            // Refresh the lights list to get the updated color swatch.
            this.lights = [...this.lights];
        });
    }

    onAfterEnter(location, commands, router) {
        this.location = location;
        this.initBridge();
    }

    async initBridge() {
        this.bridge = Philips.getStoredAccounts()[this.location.params.bridge];
        this.lights = await Philips.getLights(this.bridge);
    }

    async lightClicked(e) {
        let index = e.currentTarget.getAttribute("key");
        let light = this.lights[index];

        try {
            await Philips.toggleLight(this.bridge,light);
            this.lights = [...this.lights];
        } catch (error) {
            // TODO
        }
    }

    colorClicked(e) {
        let index = e.currentTarget.getAttribute("key");
        let light = this.lights[index];
    
        let dialog = this.renderRoot.querySelector("change-color-dialog");
        dialog.bridge = this.bridge;
        dialog.light = light;
        
        this.renderRoot.querySelector("change-color-dialog").colorPicker.color.hexString = light.rgb.hex;
        dialog.openDialog();
    }

    createRenderRoot() {
        return this;
    }

    render() {
        return html`
        <ol id="light-list" class="px-4">
            ${this.lights.map((light,index) => {
                return html`
                <li class="flex items-center space-x-4">
                    <div>
                        <button key=${index} @click="${this.lightClicked}">
                            <i class="text-xl fa-lightbulb
                                ${light.state.on ? "far" : "fas"}
                            "></i>
                        </button>
                    </div>
                    <div class="flex flex-col min-w-fit"> 
                        <div class="font-sans font-semibold text-xl">${light.name}</div>
                        <div class="font-sans font-normal text-medium text-slate-600">${light.type}</div>
                    </div>
                    <div class="flex flex-row-reverse w-full">
                        <button key=${index} @click="${this.colorClicked}" class="w-8 h-6" style="background-color:${light.rgb.hex}"></button>
                    </div>
                </li>
                <hr>
                `
            })}
        </ol>
        <change-color-dialog></change-color-dialog>
        
        `
    }
}

export class ChangeColorDialog extends LitElement {
    colorPicker;

    static get properties() {
        return {
            bridge: {type: Object},
            light: {type: Object}
        };
    }

    constructor() {
        super();
        this.bridge = {};
        this.light = {
            name: "",
            rgb: {
                hex: ""
            }
        };
    }

    firstUpdated() {
        this.colorPicker = new iro.ColorPicker("#iro-container");
        this.colorPicker.on("color:change",(color) => { this.colorChanged(color) });
    }

    openDialog() {
        this.renderRoot.querySelector("#change-color-dialog").showModal();
    }

    closeDialog() {
        this.renderRoot.querySelector("#change-color-dialog").close();
        this.dispatchEvent(new CustomEvent("color-changed", {
            bubbles: true
        }));
    }

    async colorChanged(color) {
        //let color = this.renderRoot.querySelector("#pick-color").value;
        let colorHex = color.hexString;
        let lock = this.renderRoot.querySelector("#lock-brightness").checked;

        try {
            await Philips.changeColor(this.bridge,this.light,colorHex,lock);
        } catch (error) {
            // TODO
        }
    }

    createRenderRoot() {
        return this;
    }

    render() {
        return html`
        <dialog id="change-color-dialog"
                class="py-3 px-4 rounded-lg sm:w-4/5 sm:max-w-sm w-screen sm:my-auto mt-3 mx-auto">
            <h3 class="font-semibold text-gray-900">Set Color of ${this.light.name}</h3>
            <div class="w-full flex flex-col mt-4">
                <!--
                <div class="flex items-center mt-2">
                    
                    <label for="pick-color" class="text-sm font-medium text-gray-900 mr-2">Color:</label>
                
                    <input type="color" id="pick-color" .value="${this.light.rgb.hex}" 
                        @change="${this.colorChanged}"
                        @input="${this.colorChanged}"
                    >
                    
                </div>
                -->
                <div class="mt-2" id="iro-container"></div>
        
                <div class="flex items-center mt-2">
                    <input type="checkbox" id="lock-brightness" class="w-4 h-4">
                    <label for="lock-brightness" class="text-sm font-medium text-gray-900 ml-1">Lock Brightness</label>
                </div>
            </div>
            <div id="coloris-container"></div>
            <div class="w-full flex flex-row-reverse mt-4">
                <button id="change-color-close" value="Close" @click="${this.closeDialog}"
                        class="inline-flex rounded-md mr-2 bg-gray-200 text-black px-2 py-1 text-sm hover:bg-gray-100">
                    Close
                </button>
            </div>
        </dialog>
        `
    }
}

customElements.define('light-list',LightList);
customElements.define('change-color-dialog',ChangeColorDialog);
