// gather interface, host status

var params = JSON.parse(value);
// token = '{$Z_API_SESSIONID}';
// url = '{$ZABBIX.URL}' + '/api_jsonrpc.php';
token = params.token;
url = params.url + '/api_jsonrpc.php';

var req = new HttpRequest();
req.addHeader('Content-Type: application/json');
req.addHeader('Authorization: Bearer ' + token);

// zabbix agent active (type:7) item list from a real host object
Zabbix.Log(params.loglevel, "Zabbix API, fetch item.get");
var ItemList = JSON.parse(req.post(url,
    '{"jsonrpc":"2.0","method":"item.get","params":{"output":["name","hostid","state","status","error","type","flags"]},"id":1}'
)).result;
// ,"monitored":1


Zabbix.Log(params.loglevel, "Zabbix API, fetch discoveryrule.get");
var LLDList = JSON.parse(req.post(url,
    '{"jsonrpc":"2.0","method":"discoveryrule.get","params":{"output":["name","hostid","state","status","error","type"],"monitored":1},"id":1}'
)).result;

// get list of interfaces
Zabbix.Log(params.loglevel, "Zabbix API, fetch hostinterface.get");
var interfaceList = JSON.parse(req.post(url,
    '{"jsonrpc":"2.0","method":"hostinterface.get","params":{"output":["errors_from","disable_until","dns","main","error","available","useip","hostid","type","port","ip"]},"id": 1}'
)).result;

// get list of hosts
Zabbix.Log(params.loglevel, "Zabbix API, fetch host.get");
var hostList = JSON.parse(req.post(url,
    '{"jsonrpc":"2.0","method":"host.get","params":{"output":["host","name","hostid","status","proxyid","active_available"]},"id": 1}'
)).result;

// get list of proxies
Zabbix.Log(params.loglevel, "Zabbix API, fetch proxy.get");
var proxyList = JSON.parse(req.post(url,
    '{"jsonrpc":"2.0","method":"proxy.get","params":{"output":["name","proxyid"]},"id": 1}'
)).result;

Zabbix.Log(params.loglevel, "Zabbix API, prepare unsup, disabled, active utens");
var activeItemList = [];
var disabledItems = [];
var unsupportedItems = [];
var hostName = '';
for (i in ItemList) {
    // locate host origin the item belongs
    for (h in hostList) {
        if (hostList[h].hostid === ItemList[i].hostid) {
            hostName = hostList[h].name;
            break;
        }
    }

    // active item list
    if (parseInt(ItemList[i].type) === 7) {
        var row = {};
        row["hostid"] = ItemList[i].hostid;
        row["itemid"] = ItemList[i].itemid;
        activeItemList.push(row);
    }

    // disabled items
    if (parseInt(ItemList[i].status) === 1) {
        var row = {};
        row["hostid"] = ItemList[i].hostid;
        row["itemid"] = ItemList[i].itemid;
        row["name"] = hostName;
        disabledItems.push(row);
    }

    // unsupported items
    if (parseInt(ItemList[i].state) === 1 && ItemList[i].error !== '') {
        var row = {};
        row["name"] = ItemList[i].name;
        row["error"] = ItemList[i].error;
        row["hostid"] = ItemList[i].hostid;
        row["host"] = hostName;
        unsupportedItems.push(row);
    }

}

Zabbix.Log(params.loglevel, "Zabbix API, prepare ended");


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


Zabbix.Log(params.loglevel, "Zabbix API, unsupported LLDs");
unsupportedLLDs = [];
for (l in LLDList) {
    if (parseInt(LLDList[l].state) === 1 && LLDList[l].error !== '') {
        var row = {};
        row["name"] = LLDList[l].name;
        row["error"] = LLDList[l].error;
        row["hostid"] = LLDList[l].hostid;
        // locate human readable host name
        for (h in hostList) {
            if (hostList[h].hostid === LLDList[l].hostid) {
                row["host"] = hostList[h].name;
                break;
            }
        }
        unsupportedLLDs.push(row);
    }
}


// Unsupported items by count
var counts = {}; var unsupportedItemsCount = []; var i;
// Count occurrences
for (i = 0; i < unsupportedItems.length; i++) { var id = unsupportedItems[i].hostid; if (counts[id]) { counts[id]++ } else { counts[id] = 1 } }
// Convert to desired output format
for (var id in counts) { unsupportedItemsCount.push({ "hostid": id, "count": String(counts[id]) }); }

// add host origin to unsupported items
var unsupportedItemsWithHost = [];
for (u in unsupportedItemsCount) {
    for (h in hostList) {
        if (hostList[h].hostid === unsupportedItemsCount[u].hostid) {
            var row = {};
            row["host"] = hostList[h].name;
            row["sort"] = unsupportedItemsCount[u].count;
            row["count"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=item.list&context=host&filter_hostids[]=' + hostList[h].hostid + '&filter_name=&filter_key=&filter_type=-1&filter_value_type=-1&filter_history=&filter_trends=&filter_delay=&filter_evaltype=0&filter_tags[0][tag]=&filter_tags[0][operator]=0&filter_tags[0][value]=&filter_state=1&filter_with_triggers=-1&filter_inherited=-1&filter_discovered=-1&filter_set=1\' target=\'_blank\'>' + unsupportedItemsCount[u].count + '</a>';
            break;
        }
    }
    unsupportedItemsWithHost.push(row);
}

// sort by column "sort" with biggest numbers on top
unsupportedItemsWithHost.sort(function (a, b) { return Number(b.sort) - Number(a.sort); });

// delete "sort" column
for (var i = 0; i < unsupportedItemsWithHost.length; i++) { delete unsupportedItemsWithHost[i].sort; }





// Disabled items by count
var counts = {}; var disabledItemsCount = []; var i;

// Count occurrences by hostid+name combination
for (i = 0; i < disabledItems.length; i++) {
    var hostid = disabledItems[i].hostid;
    var name = disabledItems[i].name;
    var key = hostid + "|" + name;
    if (counts[key]) { counts[key].count += 1; } else { counts[key] = { hostid: hostid, name: name, count: 1 }; }
}

// Convert to disabledItemsCount array
for (var key in counts) {
    var entry = counts[key];
    disabledItemsCount.push({
        hostid: entry.hostid,
        name: entry.name,
        count: String(entry.count) });
}

var disabledItemsWithHost = [];
for (u in disabledItemsCount) {
    for (h in hostList) {
        if (hostList[h].hostid === disabledItemsCount[u].hostid) {
            var row = {};
            row["host"] = hostList[h].name;
            row["sort"] = disabledItemsCount[u].count;
            row["count"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=item.list&context=host&filter_hostids[]=' + hostList[h].hostid + '&filter_name=&filter_key=&filter_type=-1&filter_value_type=-1&filter_history=&filter_trends=&filter_delay=&filter_evaltype=0&filter_tags[0][tag]=&filter_tags[0][operator]=0&filter_tags[0][value]=&filter_state=1&filter_with_triggers=-1&filter_inherited=-1&filter_discovered=-1&filter_set=1\' target=\'_blank\'>' + disabledItemsCount[u].count + '</a>';
            break;
        }
    }
    disabledItemsWithHost.push(row);
}


// Sort by count descending
disabledItemsCount.sort(function (a, b) { return Number(b.count) - Number(a.count); });

// delete "sort" column
for (var i = 0; i < disabledItemsWithHost.length; i++) { delete disabledItemsWithHost[i].sort; }




// unsupported LLDs by count
var counts = {};
var unsupportedLLDsCount = [];
var i;
// Count occurrences
for (i = 0; i < unsupportedLLDs.length; i++) {
    var id = unsupportedLLDs[i].hostid;
    if (counts[id]) {
        counts[id]++;
    } else {
        counts[id] = 1;
    }
}
// Convert to desired output format
for (var id in counts) {
    unsupportedLLDsCount.push({ "hostid": id, "count": String(counts[id]) });
}

// add host origin to unsupported items
var unsupportedLLDsWithHost = [];
for (u in unsupportedLLDsCount) {
    for (h in hostList) {
        if (hostList[h].hostid === unsupportedLLDsCount[u].hostid) {
            var row = {};
            row["host"] = hostList[h].name;
            row["sort"] = unsupportedLLDsCount[u].count;
            row["count"] = '<a href=\'{$ZABBIX.URL}/host_discovery.php?context=host&filter_hostids[]=' + hostList[h].hostid + '&filter_name=&filter_key=&filter_type=-1&filter_delay=&filter_lifetime_type=-1&filter_enabled_lifetime_type=-1&filter_snmp_oid=&filter_state=1&filter_set=1\' target=\'_blank\'>' + unsupportedLLDsCount[u].count + '</a>';
            break;
        }
    }
    unsupportedLLDsWithHost.push(row);

}

// sort by column "sort" with biggest numbers on top
unsupportedLLDsWithHost.sort(function (a, b) {
    return Number(b.sort) - Number(a.sort);
});

// delete "sort" column
for (var i = 0; i < unsupportedLLDsWithHost.length; i++) {
    delete unsupportedLLDsWithHost[i].sort;
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
//     'unsupportedLLDs': unsupportedLLDs,

return JSON.stringify({
    'disabledItemsWithHost': disabledItemsWithHost,
    'unsupportedLLDsWithHost': unsupportedLLDsWithHost,
    'unsupportedItemsWithHost': unsupportedItemsWithHost,
    'passiveNotWorking': passiveNotWorking,
    'proxyList': proxyList,
    'onlyActiveHostList': onlyActiveHostList,
    'activeUnavailable2': activeUnavailable2,
    'activeUnknown0': activeUnknown0
});