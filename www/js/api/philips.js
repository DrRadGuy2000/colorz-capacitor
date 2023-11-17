export function scanForBridges() {
    if (typeof ssdp === "undefined") {
        console.log("No service discovery available...");
    }

    ssdp.search("ssdp:all",
        async function(device) {
            // Success
            if (device.location.indexOf("/description.xml") >= 0) {
                await detectBridge(device.location);
                document.getElementById("bridge-list").addItem({
                    name: 'Hue Bridge',
                    ip: '0.0.0.0'
                });
                console.log(device);
            }
        },
        function(error) {
            // Failure
            console.log(error);
        }
    );    
}

export async function detectBridge(url) {
    var response = await fetch(url);
    var type = response.headers.get("content-type");
    if (type !== "text/xml") { throw new Error("Non-XML content was returned."); }

    var text = await response.text();
    var p = new DOMParser();
    var xml = p.parseFromString(text,"text/xml");
    var friendly = xml.getElementsByTagName("friendlyName");
    if (typeof friendly[0] === "undefined" || friendly[0].childNodes[0].nodeValue.indexOf("Hue Bridge") < 0) {
        throw new Error("Doesn't appear to be a Hue bridge.");
    }

    return xml.getElementsByTagName("UDN")[0].childNodes[0].nodeValue;    
}

export function getStoredAccounts() {
    var accounts = localStorage.getItem("bridgeAccounts");
    if (!accounts) {
        accounts = [];
    }
    else {
        accounts = JSON.parse(accounts);
    }
    return accounts;    
}

export function addStoredAccount(data) {
    var accounts = getStoredAccounts();

    if (!accounts.find(function(account) {
        return account.uuid === data.uuid;
    })) {
        accounts.push(data);
    }

    localStorage.setItem("bridgeAccounts",JSON.stringify(accounts));
}

export async function postAccount(item) {
    var start = new Date().getTime();
    var elapsed = 0;

    while (elapsed < (120 * 1000)) {
        var response = await fetch('http://' + item.ip + "/api",{
            method: 'POST',
            body: JSON.stringify({"devicetype": "Colorz"})
        });

        var res = await response.text();
        if (res.length > 0) {
            // Sometimes philips just goes ahead and garbles its own JSON response. Isn't that fun?
            try {
                res = JSON.parse(res);
            } catch (err) {
                continue;
            }
        }
        else {
            continue;
        }

        if (typeof res[0].error === "object" && res[0].error.type === 101) {
            // Keep trying until user pushes the button.
            await sleep(5000);
            elapsed = new Date().getTime() - start;
            continue;
        }

        if (typeof res[0].success === "object") {
            item.account = res[0].success.username;
            addStoredAccount(item);
            return;
        }
        else {
            // Throw some kind of error I suppose.
            throw new Error("Something sure didn't work out.");
        }
    }
}

export async function getLights(bridge) {
    var lightUrl = v1Url(bridge) + "/lights";
    let response = await fetch(lightUrl);
    let data = await response.text();
    let lights = [];
    try {
        data = correctResponse(data);

        lights = Object.keys(data).map((light) => {
            return {
                state: data[light].state,
                id: light,
                type: data[light].type,
                name: data[light].name,
                rgb: XYtoRGB({
                    x: data[light].state.xy[0],
                    y: data[light].state.xy[1],
                    brightness: data[light].state.bri
                })
            };
        });
    } catch (error) {
        console.log(error);
        console.log(data);
        return;
    }

    return lights;
}

export async function toggleLight(bridge,light) {
    var lightUrl = v1Url(bridge) + "/lights/" + light.id + "/state";
    await fetch(lightUrl,{
        method: 'PUT',
        body: JSON.stringify({
            "on": !light.state.on
        })
    });
    light.state.on = !light.state.on;
}

export function RGBtoXY(rgb) {
    let index = (rgb.charAt(0) === "#") ? 1 : 0;

    /* Normalize color values */
    let colorIn = {
        red: parseInt(rgb.substr(index,2),16) / 255,
        green: parseInt(rgb.substr(index+2,2),16) / 255,
        blue: parseInt(rgb.substr(index+4,2),16) / 255
    };
    
    let colorOut = {};

    // Make red more vivid
    colorOut.red = (colorIn.red > 0.04045) ?
        Math.pow((colorIn.red + 0.055) / (1.0 + 0.055), 2.4) : (colorIn.red / 12.92);

    // Make green more vivid
    colorOut.green = (colorIn.green > 0.04045) ?
        Math.pow((colorIn.green + 0.055) / (1.0 + 0.055), 2.4) : (colorIn.green / 12.92);

    // Make blue more vivid
    colorOut.blue = (colorIn.blue > 0.04045) ?
        Math.pow((colorIn.blue + 0.055) / (1.0 + 0.055), 2.4) : (colorIn.blue / 12.92);

    /* Matrix theory or whatever, don't fucking ask me. */
    colorOut.x = colorOut.red * 0.4124 + colorOut.green * 0.3576 + colorOut.blue * 0.1805;
    colorOut.y = colorOut.red * 0.2126 + colorOut.green * 0.7152 + colorOut.blue * 0.0722;
    colorOut.z = colorOut.red * 0.0193 + colorOut.green * 0.1192 + colorOut.blue * 0.9505;

    return {
        x: colorOut.x / (colorOut.x + colorOut.y + colorOut.z),
        y: colorOut.y / (colorOut.x + colorOut.y + colorOut.z),
        brightness: Math.round(colorOut.y * 254)
    };
}

export function XYtoRGB(color) {
    let z = 1 - color.x - color.y;
    let brightness = color.brightness / 254;

    let colorIn = {
        x: (brightness / color.y) * color.x,
        y: brightness,
        z: (brightness / color.y) * z,
    }

    /* THANKS A LOT, PHILIPS YOU JACKASSES THIS IS NOT THE RIGHT MATRIX AT ALL */
    /*
    let colorOut = {
        r: colorIn.x * 1.656492 - colorIn.y * 0.354851 - colorIn.z * 0.255038,
        g: colorIn.x * -0.707196 + colorIn.y * 1.655397 + colorIn.z * 0.036152,
        b: colorIn.x * 0.051713 - colorIn.y * 0.121364 + colorIn.z * 1.011530
    }
    */
    
    
    let colorOut = {
        r: colorIn.x * 3.240625 - colorIn.y * 1.537208- colorIn.z * 0.498629,
        g: colorIn.x * -0.968931 + colorIn.y * 1.875756 + colorIn.z * 0.041518,
        b: colorIn.x * 0.055710 - colorIn.y * 0.204021 + colorIn.z * 1.056996
    }

    if (colorOut.r < 0) colorOut.r = 0;
    if (colorOut.g < 0) colorOut.g = 0;
    if (colorOut.b < 0) colorOut.b = 0;
    
    colorOut.r = (colorOut.r <= 0.0031308) ? 
        (colorOut.r * 12.92) : ((1.0 + 0.055) * Math.pow(colorOut.r, (1.0 / 2.4)) - 0.055);
    colorOut.g = (colorOut.g <= 0.0031308) ? 
        (colorOut.g * 12.92) : ((1.0 + 0.055) * Math.pow(colorOut.g, (1.0 / 2.4)) - 0.055);
    colorOut.b = (colorOut.b <= 0.0031308) ? 
        (colorOut.b * 12.92) : ((1.0 + 0.055) * Math.pow(colorOut.b, (1.0 / 2.4)) - 0.055);

    colorOut.r = Math.round(colorOut.r * 255);
    colorOut.g = Math.round(colorOut.g * 255);
    colorOut.b = Math.round(colorOut.b * 255);

    colorOut.hex = "#"
        + (0 + Number(colorOut.r).toString(16)).slice(-2)
        + (0 + Number(colorOut.g).toString(16)).slice(-2)
        + (0 + Number(colorOut.b).toString(16)).slice(-2);

    return colorOut;
}

let lastcall = new Date().getTime();

export async function changeColor(bridge,light,color,lock) {
    if (new Date().getTime() - lastcall < 200) {
        return;
    }

    lastcall = new Date().getTime();

    let lightUrl = v1Url(bridge) + "/lights/" + light.id + "/state";
    let hsv = RGBtoXY(color);
    let bri = lock ? light.state.bri : hsv.brightness;

    await fetch(lightUrl,{
        method: 'PUT',
        body: JSON.stringify({
            "xy": [
                    hsv.x,
                    hsv.y
                ],
            "bri": bri
        })
    });

    light.state.x = hsv.x;
    light.state.y = hsv.y;
    light.state.bri = bri;
    light.rgb.hex = color;
}

function correctResponse(data) {
    data = JSON.parse(data);
    if (typeof data !== "object") {
        if (data.substr(data.length-2) !== "}}" && data.substr(data.length-1) === "}") {
            data += "}";
            data = JSON.parse(data);
        }
    }
    return data;
}

function v1Url(bridge) {
    return "http://" + bridge.ip + "/api/" + bridge.account;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
