#!/bin/bash

while : 
do
    ./get_info.exp > output.txt
    sudo python3 parse_output.py
    # remember to add code to zip jsons after a while
    sleep 1
done;