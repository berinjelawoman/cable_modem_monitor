#!/usr/bin/env python3

import sys
import json
import asyncio
import websockets
import websockets.server

import data_parser as dp


async def handler(websocket: websockets.server.WebSocketServerProtocol):
    """
    Handles data connection and dispatches necessary data
    """
    print("Connected")
    # Receive and parse the amount of days wanted
    message = await websocket.recv()
    print(message)
    json_message = json.loads(message)
    days = json_message["days"]
    
    for i, data in enumerate(dp.get_upto_nth_usage_data(days)):
        to_send = {}
        to_send["id"] = i
        to_send["data"] = data
        await websocket.send(json.dumps(to_send, separators=(",", ":")))
        

    print("All data has been sent")
    # send empty data with negative IP to mark message end
    to_send = {}
    to_send["id"] = -1
    to_send["data"] = []
    await websocket.send(json.dumps(to_send, separators=(",", ":")))


async def main(port: int):
    async with websockets.serve(handler, "", port):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    data_path = sys.argv[-2]
    port = sys.argv[-1]
    dp.set_data_folder(data_path)
    asyncio.run(main(port))
