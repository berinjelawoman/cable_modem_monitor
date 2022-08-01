#!/bin/bash
counter=0
version=0


while : 
do
    ./get_info.exp > output.txt
    sudo python3 parse_output.py
    # remember to add code to zip jsons after a while
    counter=$((counter+1))
    if [ $counter -gt 500 ]; then
        # zip file
        sudo tar -zcvf "~/.bk/df${version}.tar.gz" /var/www/monitor/test/files/df_bk.json
        sudo rm /var/www/monitor/test/files/df_bk.json

        counter=0
        version=$((version+1))
    fi

    sleep 1
done;