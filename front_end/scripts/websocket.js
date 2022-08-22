let data_globals = {
    x: [],
    y_ups: [],
    y_dss: [],
    y: []
}

function getStandardDeviation (array) {
    const n = array.length
    const mean = array.reduce((a, b) => a + b) / n
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}

function filterOutliersIndexed(someArray) {

    if(someArray.length < 4)
        return someArray;
  
    let values, q1, q3, iqr, maxValue, minValue;
  
    values = someArray.slice().sort( (a, b) => a - b);//copy array fast and sort
  
    if((values.length / 4) % 1 === 0){//find quartiles
        q1 = 1/2 * (values[(values.length / 4)] + values[(values.length / 4) + 1]);
        q3 = 1/2 * (values[(values.length * (3 / 4))] + values[(values.length * (3 / 4)) + 1]);
    } else {
        q1 = values[Math.floor(values.length / 4 + 1)];
        q3 = values[Math.ceil(values.length * (3 / 4) + 1)];
    }
  
    iqr = q3 - q1;
    maxValue = q3 + iqr * 1.5;
    minValue = q1 - iqr * 1.5;

    if (maxValue > 500) maxValue = 500;

    return someArray.reduce((acc, x, i) => {
        if ((x >= minValue) && (x <= maxValue)) acc.push(i);
        return acc;
    }, []);
}


/**
 * Transforms n data points into one by taking the mean of its neighbors
 * @param {*} data 
 * @param {*} n 
 * @returns 
 */
function reduceDataSize(m_data, n) {
    let keys = Object.keys(m_data);
    [x, y, y_up, y_ds, total_usage] = getNetworkData(m_data);

    let n_x = [];
    let n_y_ups = [];
    let n_y_dss = [];
    let n_ys = [];

    for (let i=0; i < keys.length - n; i+=n) {
        n_x.push(unix_to_date(keys[i]));
        let n_y_up = y_up.slice(i, i+n).reduce((x, y) => x + y, 0) / n
        let n_y_ds = y_ds.slice(i, i+n).reduce((x, y) => x + y, 0) / n
        n_y_ups.push(n_y_up);
        n_y_dss.push(n_y_ds);
        n_ys.push(n_y_up + n_y_ds);
    }

    let indexes = filterOutliersIndexed(n_ys);
    
    [n_x, n_ys, n_y_ups, n_y_dss] = indexes.reduce((acc, i) => {
        acc[0].push(n_x[i]);
        acc[1].push(n_ys[i]);
        acc[2].push(n_y_ups[i]);
        acc[3].push(n_y_dss[i]);
        return acc;
    }, [[], [], [], []]);

    data_globals.x = [...n_x, ...data_globals.x]
    data_globals.y_ups = [...n_y_ups, ...data_globals.y_ups];
    data_globals.y_dss = [...n_y_dss, ...data_globals.y_dss];
    data_globals.y = [...n_ys, ...data_globals.y];

    let title = "Usagem total de dados";
    let div_id = "net_usage_all";


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
        x: data_globals.x,
        y: total_usage,
        mode: 'lines+markers',
        yaxis: "y1",
        name: "Uso" 
    };

    let trace2 = {
        x: data_globals.x,
        y: data_globals.y,
        line: {color: 'rgb(0, 153, 0)'},
        mode: 'lines+markers',
        yaxis: "y2",
        name: "Velocidade Total" 
    };

    let trace3 = {
        x: data_globals.x,
        y: data_globals.y_ups,
        line: {color: 'rgb(0, 255, 0)'},
        mode: 'lines+markers',
        yaxis: "y2",
        name: "Velocidade Upload" 
    };

    let trace4 = {
        x: data_globals.x,
        y: data_globals.y_dss,
        line: {color: 'rgb(204, 255, 153)'},
        mode: 'lines+markers',
        yaxis: "y2",
        name: "Velocidade Download" 
    };

    let data = [trace1, trace2, trace3, trace4];
    
    let config = {responsive: true};

    Plotly.newPlot(div_id, data, layout, config);
}


function receiveData(websocket) {
    websocket.addEventListener("message", ({ data: _data }) => {
        try {
            let json = JSON.parse(_data);
            let data = json["data"];

            if (json["id"] != -1)
                reduceDataSize(data, 100);
                
        } catch (e) { console.log(e); }
    });
}


function createWebsocket() {
    const websocket = new WebSocket("ws://192.168.1.41:8001/");
    
    receiveData(websocket);
    websocket.addEventListener("open", () => {
        websocket.send(JSON.stringify({"days": 7}));
    })
    return websocket;
}