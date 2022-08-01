#!/bin/bash

sudo rm -rf /var/www/monitor/test/scripts
sudo rsync -av ./* /var/www/monitor/test --exclude=install.sh