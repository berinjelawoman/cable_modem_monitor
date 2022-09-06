#!/bin/bash
counter=0

while : 
do
    ./my_test.exp >> output_test.txt
    # remember to add code to zip jsons after a while
    counter=$((counter+1))
    if [ $counter -gt 500 ]; then
        exit
    fi

    sleep 10
done;
