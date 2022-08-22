const CONSTANTS = {
    FLOOR_SELECTOR_DIV: document.getElementById("myForm"),
    OFFLINE_MODAL: document.getElementById("myModal"),
    OFFLINE_MODAL_BODY: document.getElementById("modalBody"),
    OFFLINE_MODAL_HEADER: document.getElementById("modalHeaderTitle")
};


let globals = {
    websocket: null,
    first: true,
    data: null,
    floors: [] // list of strings containing the floor numbers
};



let options = {
    pause: false
};

/**
 * converts a unix timestamp into the default js date type
 * @param {int} timestamp 
 * @returns {Date} the date in a js object
 */
function unix_to_date(timestamp) {
    let date = new Date(timestamp * 1000); // multiply by 1000 to convert from s to ms
    return date;
}


function getNetworkData(m_data) {
    let keys = Object.keys(m_data);
    let values = Object.values(m_data);

    let x = keys.map((key) => unix_to_date(key));
 
    // connection total usage
    let usage_up = keys.map(key => m_data[key]["Us Bytes"].filter(x => x > 0).reduce((x, y) => x + y, 0) );
    let usage_ds = keys.map(key => m_data[key]["Ds Bytes"].filter(x => x > 0).reduce((x, y) => x + y, 0) );
    let total_usage = keys.map((_, i) => (usage_ds[i] + usage_up[i]) * 1e-9 );

    // connection speed
    let y_up = values.slice(1).map((_, i) => (usage_up[i+1] - usage_up[i]) / (keys[i+1] - keys[i]) / 125000);
    let y_ds = values.slice(1).map((_, i) => (usage_ds[i+1] - usage_ds[i]) / (keys[i+1] - keys[i]) / 125000);

    for (let i=0; i < y_up.length; i++) {
        if (y_up[i] >= 0 && y_ds[i] >= 0) continue;

        if (i > 0) {
            y_up[i] = y_up[i - 1];
            y_ds[i] = y_ds[i - 1];
        } else {
            y_up[i] = y_up[i + 1];
            y_ds[i] = y_ds[i + 1];
        }
    }


    // add first known value to y
    y_up = [y_up[0], ...y_up];
    y_ds = [y_ds[0], ...y_ds];

    let y = y_up.map((_, i) => (y_up[i] + y_ds[i]));

    return [x, y, y_up, y_ds, total_usage];
}


/**
 * Builds a network usage graph with the given data
 * @param {JSON} m_data 
 * @param {string} title 
 * @param {string} div_id 
 * @param {string} xaxis_title 
 * @param {string} yaxis_title 
 */
function buildNetworkGraph(m_data, title, div_id, newPlot=false) {
    [x, y, y_up, y_ds, total_usage] = getNetworkData(m_data);
    
    if (!newPlot && !globals.first) Plotly.update(div_id, {x: [x], y: [total_usage, y, y_up, y_ds]});
    else { 
        // graph layout
        let layout = {
            title: title,
            autosize: true,
            xaxis: { title: "Tempo" },
            yaxis: { title: "Uso (Giga bytes)" },
            yaxis2: {
                title: "Velocidade (Mb/s)",
                overlaying: 'y',
                side: 'right'
            }
        };

        let trace1 = {
            x: x,
            y: total_usage,
            mode: 'lines+markers',
            yaxis: "y1",
            name: "Uso" 
        };

        let trace2 = {
            x: x,
            y: y,
            line: {color: 'rgb(0, 153, 0)'},
            mode: 'lines+markers',
            yaxis: "y2",
            name: "Velocidade Total" 
        };

        let trace3 = {
            x: x,
            y: y_up,
            line: {color: 'rgb(0, 255, 0)'},
            mode: 'lines+markers',
            yaxis: "y2",
            name: "Velocidade Upload" 
        };

        let trace4 = {
            x: x,
            y: y_ds,
            line: {color: 'rgb(204, 255, 153)'},
            mode: 'lines+markers',
            yaxis: "y2",
            name: "Velocidade Download" 
        };

        let data = [trace1, trace2, trace3, trace4];
        
        let config = {responsive: true};

        Plotly.newPlot(div_id, data, layout, config);
    }
};


/**
 * Builds two bar graphs with the given information. Used to create the power graphs in db
 * 
 * @param {JSON} m_data data to fill the graph
 * @param {String} title graph title
 * @param {String} div_id the id to draw the graph in
 * @param {String} xaxis_title 
 * @param {String} yaxis_title 
 * @param {String} name1 legend name for first bar plot
 * @param {String} name2 legend name for second bar plot
 */
function buildPwrGraph(m_data, title, div_id, xaxis_title, yaxis_title, name1, name2) {
    let [us_pwr, ds_pwr] = [[], []]; 
    
    Object.values(m_data).forEach((el) => {us_pwr.push(el[0]), ds_pwr.push(el[1])});

    // the x values of the graph
    let rooms = Object.keys(m_data).map((room) => "Room " + String(room));

    if (!globals.first) {
        Plotly.update(div_id, {x: [rooms], y: [us_pwr, ds_pwr]});
        Plotly.restyle(div_id, {text: [us_pwr.map(String), ds_pwr.map(String)]});
    }
    else {
        // graph layout
        let layout = {
            title: title,
            autosize: true,
            xaxis: { title: xaxis_title },
            yaxis: { title: yaxis_title }
        };

        let trace1 = {
            x: rooms,
            y: us_pwr,
            type: 'bar',
            text: us_pwr.map(String),
            textposition: 'auto',
            hoverinfo: 'none',
            name: name1,
            marker: {
                color: 'rgb(158,0,22)',
                line: { width: 1.5 }
            }
        };
    
        let trace2 = {
            x: rooms,
            y: ds_pwr,
            type: 'bar',
            text: ds_pwr.map(String),
            textposition: 'auto',
            hoverinfo: 'none',
            name: name2,
            marker: {
                color: 'rgb(158,202,225)',
                line: { width: 1.5 }
            }
        };
    
    
        let data = [trace1, trace2];
        let config = {responsive: true};
        
        Plotly.newPlot(div_id, data, layout, config);
    }
}


function getPowerData() {
    let mkeys = Object.keys(globals.data);
    let lastData = globals.data[mkeys[mkeys.length - 1]];

    // get us and ds pwr
    let targetRooms = lastData.Room.filter(room => {
        let floor = getRoomFloor(room);
        return globals.floors.includes(floor);
    });

    let pwr = {}
    targetRooms.forEach((room) => { 
        let i = lastData.Room.indexOf(room);
        pwr[room] = [lastData["US_Pwr"][i], lastData["DS_Pwr"][i]] 
    });
    
    // get us and ds snr
    let snr = {}
    targetRooms.forEach((room) => { 
        let i = lastData.Room.indexOf(room);
        snr[room] = [lastData["US_SNR"][i], lastData["DS_SNR"][i]] 
    });

    return [pwr, snr]
}


/**
 * Adds the info to the page
 */
function addInfo(data) {
    // the MAC key holds data on which modem are online
    let mkeys = Object.keys(data);
    let lastData = data[mkeys[mkeys.length - 1]];

    let cm_online = lastData.MAC.filter(state => String(state).includes("online")).length;
    let cm_offline = lastData.MAC.filter(state => String(state).includes("offline")).length;
    let users_online = lastData.Number.filter(x => x > 0).reduce((x, y) => x + y, 0);

    // get list of macs of offline cable modems
    let cm_offline_string = lastData.Room
        .filter((_, i) => String(lastData.MAC[i]).includes("offline"))
        .map(room_n => `Quarto ${room_n}`)
        .slice(0, 10).join("\n");

    let text = `<button type="submit" class="btn">Online CMs: ${cm_online}</button>
                <button type="submit" class="btn ${cm_offline ? "cancel" : ""}" 
                  title="${cm_offline_string}" onclick="showOfflineModal('${cm_offline_string.split("\n")}', ${cm_offline})">
                    Offline CMs: ${cm_offline}
                </button>
                <button type="submit" class="btn">Usuarios ativos: ${users_online}</button>`;
    document.getElementById("info").innerHTML = text;
}


/**
 * Shows a modal containing the offline cable modem's room number
 * 
 * @param {String} offlineCMString a string with comma separated values
 * @param {Number} offlineNumber number of cable modems offline
 */
function showOfflineModal(offlineCMString, offlineNumber) {
    CONSTANTS.OFFLINE_MODAL.style.display = "block";
    
    CONSTANTS.OFFLINE_MODAL_BODY.innerHTML = offlineCMString.replaceAll(",", "<br>");
    CONSTANTS.OFFLINE_MODAL_HEADER.innerHTML = `Cable Modems Offline: ${offlineNumber}`;
}


/**
 * reads and loads the default data json and returns it
 * @returns {JSON} 
 */
async function load_json(name="files/df.json") {
    let data = null;

    let response = await fetch(name);
    data = response.json();

    return data;
}


/**
 * function to handle a async wait. call it using the `await` keyword
 * @param {int} ms the time in millisecond
 * @returns {Promise} a promise to wait by the given ms
 */
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }


/**
 * Adds or removes the floor inside the value of the given HTML Element into
 * the list of floors to show
 * @param {HTMLElement} element 
 */
function toggleFloor(element) {
    let floor = element.value;
    let i = globals.floors.indexOf(floor);

    if (i >= 0) globals.floors.splice(i, 1);
    else { 
        globals.floors.push(floor); 
        globals.floors.sort((a, b) => a - b); 
    }

    // update graph
    let [pwr, snr] = getPowerData();
    buildPwrGraph(pwr, "Pot\u00EAncia", "signal_pwr", "Quarto", "dB", "Us Pot\u00EAncia", "Ds Pot\u00EAncia");
    buildPwrGraph(snr, "Rela\u00E7\u00E3o Sinal Ru\u00EDdo", "signal_snr", "Quarto", "dB", "Us SNR", "Ds SNR");
}


function getRoomFloor(room) {
    let str_room = String(room);
    return str_room.length <= 3 ? str_room.slice(0, 1) : str_room.slice(0, 2);
}


/**
 * Creates the floor selection div element with HTML labels to select which
 * floors should be seen
 * @param {JSON} lastData 
 */
function createFloors(lastData) {
    // save the floor information
    let floors = lastData.Room
        .map(getRoomFloor) // get floor number
        .filter((v, i, a) => a.indexOf(v) === i); // remove duplicates
    
    floors.sort((a, b) => (a - b));

    globals.floors = floors;

    CONSTANTS.FLOOR_SELECTOR_DIV.innerHTML = floors.reduce((res, floor) => {
        return res + `<label class="container">${floor}
            <input type="checkbox" checked="checked" value="${floor}" onclick="toggleFloor(this)">
            <span class="checkmark"></span>
        </label>`
    }, "");
}


// async function load_all_data() {
//     let url = new URL(window.location);
//     let c = url.searchParams.get("debug");
//     if (c !== null && c > 0) {
//         // in productioin change the load_json's param to be built using the 
//         // current window location root url
//         let _data = await load_json("http://127.0.0.1/cgi-bin/files/untar_all.sh");
//         console.log( Object.values(_data).length);
//         buildNetworkGraph(_data, "Usagem total de dados", "net_usage_all", true);
//     }
// }


async function load_all_data() {
    let url = new URL(window.location);
    let c = url.searchParams.get("debug");
    if (c !== null && c > 0) {
        // in productioin change the load_json's param to be built using the 
        // current window location root url
        globals.websocket = createWebsocket();
    }
}


/**
 * run function every second
 * we do this because load_json is async
 */
async function loop() {
    //
    //
    while (true) try {

        if (!options.pause) {
            let data = await load_json();

            if (data != null) globals.data = data;

            
            buildNetworkGraph(globals.data, "Usagem de dados", "net_usage");

            // last info
            let mkeys = Object.keys(globals.data);
            let lastData = globals.data[mkeys[mkeys.length - 1]];

            // update the floors list
            if (globals.first) createFloors(lastData);

            // get us and ds power and snr
            let [pwr, snr] = getPowerData();
            buildPwrGraph(pwr, "Pot\u00EAncia", "signal_pwr", "Quarto", "dB", "Us Pot\u00EAncia", "Ds Pot\u00EAncia");
            buildPwrGraph(snr, "Rela\u00E7\u00E3o Sinal Ru\u00EDdo", "signal_snr", "Quarto", "dB", "Us SNR", "Ds SNR");

            addInfo(globals.data);

            globals.first = false;
        }

        await delay(1000)

    } catch (e) { console.log(e); }

}


loop();
load_all_data();