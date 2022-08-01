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
    while (true) {
        let data = await load_json();

        console.log(Object.keys(data).length);

        await delay(1000)
    }
}


loop();