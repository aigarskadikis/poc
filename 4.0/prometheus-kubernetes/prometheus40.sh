#!/bin/bash

# collect data and place it on 'tmp'. IP address and port will be filename
curl -skL $1://$2:$3/$4 -o /tmp/prometheus.$2.$3.json

# use JavaScript binary from 5.0 to prepare an LLD JSON
zabbix_js -s /usr/lib/zabbix/externalscripts/prometheus.json.to.lld.js -i /tmp/prometheus.$2.$3.json
