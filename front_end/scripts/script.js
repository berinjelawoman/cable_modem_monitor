// globals
let globals = {
    first: true,
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


let mdata;

/**
 * Builds a network usage graph with the given data
 * @param {JSON} m_data 
 * @param {string} title 
 * @param {string} div_id 
 * @param {string} xaxis_title 
 * @param {string} yaxis_title 
 */
function buildNetworkGraph(m_data, title, div_id) {
    let keys = Object.keys(m_data);
    let values = Object.values(m_data);

    let x = keys.map((key) => unix_to_date(key));
    let total_usage = values.map((value) => value * 1e-9);  // convert to Gb
    
    
    let y = values.slice(1).map((_, i) => (values[i+1] - values[i]) / (keys[i+1] - keys[i]) / 125000);
    // add first known value to y
    y = [y[0], ...y];
    
    if (mdata===undefined) mdata = m_data;

    if (!globals.first) Plotly.update(div_id, {x: [x], y: [total_usage, y]});
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
            line: {color: 'rgb(153, 255, 153)'},
            mode: 'lines+markers',
            yaxis: "y2",
            name: "Velocidade Total" 
        };

        let data = [trace1, trace2];
        
        let config = {responsive: true};

        Plotly.newPlot(div_id, data, layout, config);
    }
};



function buildPwrGraph(m_data, title, div_id, xaxis_title, yaxis_title, name1, name2) {
    let [us_pwr, ds_pwr] = [[], []]; 
    Object.values(m_data).forEach((el) => {us_pwr.push(el[0]), ds_pwr.push(el[1])});

    if (!globals.first) Plotly.update(div_id, {y: [us_pwr, ds_pwr]});
    else {
        // graph layout
        let layout = {
            title: title,
            autosize: true,
            xaxis: { title: xaxis_title },
            yaxis: { title: yaxis_title }
        };

        // the x values of the graph
        let rooms = Object.keys(m_data).map((room) => "Room " + String(room));

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
                usage[key] = data[key]["Us Bytes"].filter(x => x > 0).reduce((x, y) => x + y, 0) 
                    + data[key]["Ds Bytes"].filter(x => x > 0).reduce((x, y) => x + y, 0)
            });
            buildNetworkGraph(usage, "Usagem de dados", "net_usage");

            // last info
            let mkeys = Object.keys(data);
            let lastData = data[mkeys[mkeys.length - 1]];
            // get us and ds pwr
            let pwr = {}
            lastData.Room.forEach((room, i) => { pwr[room] = [lastData["US_Pwr"][i], lastData["DS_Pwr"][i]] });
            buildPwrGraph(pwr, "Pot\u00EAncia", "signal_pwr", "Quarto", "dB", "Us Pot\u00EAncia", "Ds Pot\u00EAncia");
            // get us and ds snr
            let snr = {}
            lastData.Room.forEach((room, i) => { snr[room] = [lastData["US_SNR"][i], lastData["DS_SNR"][i]] });
            buildPwrGraph(snr, "Rela\u00E7\u00E3o Sinal Ru\u00EDdo", "signal_snr", "Quarto", "dB", "Us SNR", "Ds SNR");

            addInfo(data);

            globals.first = false;
        }

        await delay(1000)

    } catch (e) { console.log(e); }

}


loop();