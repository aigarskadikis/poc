// gather interface, host status

token = '{$Z_API_SESSIONID}';
url = '{$ZABBIX.URL}' + '/api_jsonrpc.php';

var req = new HttpRequest();
req.addHeader('Content-Type: application/json');
req.addHeader('Authorization: Bearer ' + token);

// zabbix agent active (type:7) item list from a real host object
var ItemList = JSON.parse(req.post(url,
    '{"jsonrpc":"2.0","method":"item.get","params":{"output":["name","hostid","state","error","type"],"monitored":1},"id":1}'
)).result;




// unique hostid's with active checks
var uniqueHostIds = {};
var onlyActiveHostList = [];
var i;
for (i = 0; i < activeItemList.length; i++) {
    var hostid = activeItemList[i].hostid;
    if (!uniqueHostIds[hostid]) {
        uniqueHostIds[hostid] = true;
        onlyActiveHostList.push(hostid);
    }
}

// get list of interfaces
var interfaceList = JSON.parse(req.post(url,
    '{"jsonrpc":"2.0","method":"hostinterface.get","params":{"output":["errors_from","disable_until","dns","main","error","available","useip","hostid","type","port","ip"]},"id": 1}'
)).result;

// get list of hosts
var hostList = JSON.parse(req.post(url,
    '{"jsonrpc":"2.0","method":"host.get","params":{"output":["host","name","hostid","status","proxyid","active_available"]},"id": 1}'
)).result;

// get list of proxies
var proxyList = JSON.parse(req.post(url,
    '{"jsonrpc":"2.0","method":"proxy.get","params":{"output":["name","proxyid"]},"id": 1}'
)).result;


// only "Zabbix agent (active)" items
activeItemList = [];
for (i in ItemList) {
    if (parseInt(ItemList[i].type) === 7) {
        var row = {};
        row["hostid"] = ItemList[i].hostid;
        row["itemid"] = ItemList[i].itemid;
        activeItemList.push(row);
    }
}

// individual unsupported items
unsupportedItems = [];
for (i in ItemList) {
    if (parseInt(ItemList[i].state) !== 0 && ItemList[i].error !== '') {
        var row = {};
        row["name"] = ItemList[i].name;
        row["error"] = ItemList[i].error;

        // locate human readable host name
        for (h in hostList) {
            if (hostList[h].hostid === ItemList[i].hostid) {
                row["host"] = hostList[h].name;
                break;
            }
        }
        unsupportedItems.push(row);
    }
}



// iterate through host objects which hosts "Zabbix agent (active)" items
var activeUnavailable2 = [];
var activeUnknown0 = [];
for (a in onlyActiveHostList) {
    for (h in hostList) {

        // find proxy name
        var proxyName = '';
        if (parseInt(hostList[h].hostid) === parseInt(onlyActiveHostList[a])) {
            for (p in proxyList) {
                if (proxyList[p].proxyid === hostList[h].proxyid) {
                    proxyName = proxyList[p].name;
                }
            }
        }



        if (parseInt(hostList[h].active_available) === 2 && parseInt(hostList[h].hostid) === parseInt(onlyActiveHostList[a])) {
            var row = {};
            row["proxy"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=proxy.list&filter_name=' + proxyName + '&filter_operating_mode=-1&filter_version=-1&filter_set=1\' target=\'_blank\'>' + proxyName + '</a>';
            row["host"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=host.edit&hostid=' + hostList[h].hostid + '\' target=\'_blank\'>' + hostList[h].name + '</a>';
            activeUnavailable2.push(row);
        }
        if (parseInt(hostList[h].active_available) === 0 && parseInt(hostList[h].hostid) === parseInt(onlyActiveHostList[a])) {
            var row = {};
            row["proxy"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=proxy.list&filter_name=' + proxyName + '&filter_operating_mode=-1&filter_version=-1&filter_set=1\' target=\'_blank\'>' + proxyName + '</a>';
            row["host"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=host.edit&hostid=' + hostList[h].hostid + '\' target=\'_blank\'>' + hostList[h].name + '</a>';
            activeUnknown0.push(row);
        }
    }
}

// output will be an array
var passiveNotWorking = [];

// take one full itemid containing all characteristics like key_, units, name
for (i in interfaceList) {
    // merge interface table with host table by using "hostid" as mapping field
    for (h in hostList) {
        // check if there is a match between the hostid which belongs at item level and the host array
        if (
            interfaceList[i].hostid === hostList[h].hostid
            &&
            parseInt(interfaceList[i].main) === 1
            &&
            parseInt(hostList[h].status) === 0
            &&
            parseInt(interfaceList[i].available) !== 1
        ) {
            var row = {};
            row["host"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=host.edit&hostid=' + hostList[h].hostid + '\' target=\'_blank\'>' + hostList[h].name + '</a>';
            row["error"] = interfaceList[i].error;

            // locate passive checks
            if (parseInt(interfaceList[i].useip) === 1) {
                row["connect"] = interfaceList[i].ip;
            } else {
                row["connect"] = interfaceList[i].dns;
            }

            row["type"] = interfaceList[i].type;
            row["port"] = interfaceList[i].port;

            for (p in proxyList) {
                // check if this host belongs to proxy
                if (parseInt(hostList[h].proxyid) > 0) {
                    // iterate through list and try to map with existing proxy name
                    if (parseInt(hostList[h].proxyid) === parseInt(proxyList[p].proxyid)) {
                        row["proxy"] = proxyList[p].name;
                        break;
                    }
                } else {
                    row["proxy"] = '';
                }
            }

            // map the host list with proxy (if there is even a proxy)
            passiveNotWorking.push(row);

        }
    }

}

// return debug info
return JSON.stringify({
    'unsupportedItems': unsupportedItems,
    'passiveNotWorking': passiveNotWorking,
    'proxyList': proxyList,
    'onlyActiveHostList': onlyActiveHostList,
    'activeUnavailable2': activeUnavailable2,
    'activeUnknown0': activeUnknown0
});