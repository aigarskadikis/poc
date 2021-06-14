#!/bin/bash

# collect data and place it on 'tmp'. host name or IP as a filename
curl -skL $1://$2:$3/$4 -o /tmp/prometheus.$2.json

# use JavaScript binary from 5.0 to prepare an LLD JSON
/var/lib/zabbix/zabbix_js -s /usr/lib/zabbix/externalscripts/prometheus.json.to.lld.js -i /tmp/prometheus.$2.json

# send data to 'Zabbix trapper' item LLD
# must use -i argument

# send the original JSON to item

