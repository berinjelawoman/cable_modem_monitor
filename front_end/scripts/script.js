// globals
let globals = {
    first: true
}
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


/**
 * Builds a network usage graph with the given data
 * @param {JSON} m_data 
 * @param {string} title 
 * @param {string} div_id 
 * @param {string} xaxis_title 
 * @param {string} yaxis_title 
 */
function buildLineGraph(m_data, title, div_id, xaxis_title, yaxis_title) {
    // graph layout
    let layout = {
        title: title,
        autosize: true,
        xaxis: { title: xaxis_title },
        yaxis: { title: yaxis_title }
    };

    // get the cpu, ram, temp and usage data from the json
    let data = [{
        x: Object.keys(m_data).map((key) => unix_to_date(key)),
        y: Object.values(m_data).map((value) => value * 1e-9),
        mode: 'lines+markers',
        name: "key" 
    }];
    
    let config = {responsive: true};
    // the div name must be the same as the ip
    Plotly.newPlot(div_id, data, layout, config);
};



function buildBarGraph(m_data, title, div_id, xaxis_title, yaxis_title) {
    // graph layout
    let layout = {
        title: title,
        autosize: true,
        xaxis: { title: xaxis_title },
        yaxis: { title: yaxis_title }
    };

    // the x values of the graph
    let rooms = Object.keys(m_data).map((room) => "Room " + String(room));
    let [us_pwr, ds_pwr] = [[], []]; 
    Object.values(m_data).forEach((el) => {us_pwr.push(el[0]), ds_pwr.push(el[1])});

    let trace1 = {
        x: rooms,
        y: us_pwr,
        type: 'bar',
        text: us_pwr.map(String),
        textposition: 'auto',
        hoverinfo: 'none',
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
        marker: {
            color: 'rgb(158,202,225)',
            line: { width: 1.5 }
        }
    };


    let data = [trace1, trace2];

    let config = {responsive: true};
    // the div name must be the same as the ip
    Plotly.newPlot(div_id, data, layout, config);
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
    let users_online = lastData.Number.reduce((x, y) => x + y, 0);

    let text = `<p>Online CMs: ${cm_online}</p> 
                <p>Offline CMs: ${cm_offline}</p>
                <p>Usuarios ativos: ${users_online}</p>`;
    document.getElementById("info").innerHTML = text;
}



/**
 * reads and loads the default data json and returns it
 * @returns {JSON} 
 */
async function load_json() {
    let data = null;    

    response = await fetch("files/df.json");
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
 * run function every second
 * we do this because load_json is async
 */
async function loop() {
    while (true) try {

        if (!options.pause) {
            let data = await load_json();

            let usage = {}
            Object.keys(data).forEach(key => {
                usage[key] = data[key]["Us Bytes"].reduce((x, y) => x + y, 0) + data[key]["Ds Bytes"].reduce((x, y) => x + y, 0)
            });
            buildLineGraph(usage, "Usagem de dados", "net_usage", "Tempo", "Uso (Giga bytes)");

            // last info
            let mkeys = Object.keys(data);
            let lastData = data[mkeys[mkeys.length - 1]];
            let pwr = {}
            lastData.Room.forEach((room, i) => { pwr[room] = [lastData["US_Pwr"][i], lastData["DS_Pwr"][i]] });
            buildBarGraph(pwr, "Potência", "signal_pwr", "Tempo", "dB");

            addInfo(data);

            globals.first = false;
        }

        await delay(1000)

    } catch (e) {  }

}


loop();