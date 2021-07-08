#!/bin/bash

# collect data and place it on 'tmp'. IP address and port will be filename
curl -skL $1://$2:$3/$4 -o /tmp/prometheus.$2.$3.cpu.json

# use JavaScript binary from 5.0 to prepare an LLD JSON
/var/lib/zabbix/zabbix_js -s /usr/lib/zabbix/externalscripts/prometheus.json.to.lld.cpu.js -i /tmp/prometheus.$2.$3.cpu.json
