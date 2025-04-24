// gather interface, host status

function calculateBadPercent(data) {
    var counts = {};
    var badCounts = {};

    // Count total and bad occurrences for each key_
    for (var i = 0; i < data.length; i++) {
        var key = data[i]["key_"];
        var state = data[i]["state"];

        if (!counts[key]) {
            counts[key] = 0;
            badCounts[key] = 0;
        }

        counts[key]++;
        if (state === "1") {
            badCounts[key]++;
        }
    }

    // Calculate bad percentage and count for each key_
    var result = [];
    for (var k in counts) {
        var total = counts[k];
        var bad = badCounts[k];
        var percent = (bad / total) * 100;
        result.push({
            "key_": k,
            "bad": percent.toFixed(2),
            "count": total
        });
    }

    // Sort descending by bad percentage
    result.sort(function (a, b) {
        return parseFloat(b.count) - parseFloat(a.count);
    });

    return result;
}



var params = JSON.parse(value);
// token = '{$Z_API_SESSIONID}';
// url = '{$ZABBIX.URL}' + '/api_jsonrpc.php';
token = params.token;
url = params.url + '/api_jsonrpc.php';

var scriptStarts = Date.now() / 1000;
Zabbix.Log(params.loglevel, "Zabbix API, stats started");

var req = new HttpRequest();
req.addHeader('Content-Type: application/json');
req.addHeader('Authorization: Bearer ' + token);

// zabbix agent active (type:7) item list from a real host object
Zabbix.Log(params.loglevel, "Zabbix API, fetch item.get");
var ItemList = JSON.parse(req.post(url,
    '{"jsonrpc":"2.0","method":"item.get","params":{"output":["name","hostid","state","status","error","type","flags","key_"]},"id":1}'
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

// get list of triggers
Zabbix.Log(params.loglevel, "Zabbix API, fetch trigger.get");
var triggerList = JSON.parse(req.post(url,
    '{"jsonrpc":"2.0","method":"trigger.get","params":{"output":["triggerid","description","status","error","hosts"],"selectHosts":["name"]},"id":1}'
)).result;

// get list of proxies
Zabbix.Log(params.loglevel, "Zabbix API, fetch proxy.get");
var proxyList = JSON.parse(req.post(url,
    '{"jsonrpc":"2.0","method":"proxy.get","params":{"output":["name","proxyid"]},"id": 1}'
)).result;

// API fetching completed
var calculationStarts = Date.now() / 1000;

// build a map for fast hostid lookup
Zabbix.Log(params.loglevel, "Zabbix API, build a map for fast hostid lookup");
var hostMap = {};
for (var h in hostList) {
    var host = hostList[h];
    hostMap[host.hostid] = host;  // map hostid to the entire host object
}

// build a map for fast proxyid lookup
Zabbix.Log(params.loglevel, "Zabbix API, build a map for fast proxyid lookup");
var proxyMap = {};
for (var p in proxyList) {
    var proxy = proxyList[p];
    proxyMap[proxy.proxyid] = proxy;  // map proxyid to the entire host object
}


// triggers with errors
Zabbix.Log(params.loglevel, "Zabbix API, amount of corrupted triggers per host");
var triggersWithErrors = [];
for (t in triggerList) {
    // there is an error, and trigger is not disabled
    if (triggerList[t].error !== '' && parseInt(triggerList[t].status) === 0) {
        var row = triggerList[t];
        row["name"] = triggerList[t].hosts[0].name;
        row["hostid"] = triggerList[t].hosts[0].hostid;
        delete triggerList[t].hosts;
        delete triggerList[t].status;
        delete triggerList[t].triggerid;
        triggersWithErrors.push(row);
    }
}
// corrupted triggers by count
var countsT = {}; var triggersWithErrorsCount = []; var i;
// Count occurrences by hostid+name combination
for (i = 0; i < triggersWithErrors.length; i++) {
    var hostid = triggersWithErrors[i].hostid;
    var name = triggersWithErrors[i].name;
    var key = hostid + "|" + name;
    if (countsT[key]) { countsT[key].count += 1; } else { countsT[key] = { hostid: hostid, name: name, count: 1 }; }
}
// Convert to triggersWithErrorsCount array
for (var key in countsT) {
    var entry = countsT[key];
    triggersWithErrorsCount.push({ hostid: entry.hostid, name: entry.name, count: String(entry.count) });
}
var triggersWithErrorsWithHost = [];
for (u in triggersWithErrorsCount) {
    var row = {};
    row["host"] = triggersWithErrorsCount[u].name;
    row["sort"] = triggersWithErrorsCount[u].count;
    row["count"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=trigger.list&context=host&filter_hostids[]=' + triggersWithErrorsCount[u].hostid + '&filter_name=&filter_state=1&filter_value=-1&filter_evaltype=0&filter_tags[0][tag]=&filter_tags[0][operator]=0&filter_tags[0][value]=&filter_inherited=-1&filter_discovered=-1&filter_dependent=-1&filter_set=1\' target=\'_blank\'>' + triggersWithErrorsCount[u].count + '</a>';
    triggersWithErrorsWithHost.push(row);
}
// Sort by count descending
triggersWithErrorsWithHost.sort(function (a, b) { return Number(b.sort) - Number(a.sort); });
// delete "sort" column
for (var i = 0; i < triggersWithErrorsWithHost.length; i++) { delete triggersWithErrorsWithHost[i].sort; }



// extract disabled hosts
var disabledHosts = [];
for (d in hostList) {
    if (parseInt(hostList[d].status) === 1) {
        var host = hostList[d];
        var proxy = proxyMap[host.proxyid];
        var row = {};
        if (proxy) { row["proxy"] = proxy.name; } else { row["proxy"] = ''; }
        row["host"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=host.edit&hostid=' + hostList[d].hostid + '\' target=\'_blank\'>' + hostList[d].name + '</a>';
        disabledHosts.push(row);
    }
}



Zabbix.Log(params.loglevel, "Zabbix API, prepare unsup, disabled, active utens");
var activeItemList = [];
var disabledItems = [];
var itemsAreRunning = [];
var unsupportedItems = [];
var ratioItemKeyWorking = [];
var hostName = '';
var hostStatus = 9;
for (i in ItemList) {
    // locate host origin the item belongs
    var item = ItemList[i];
    var host = hostMap[item.hostid];

    if (host) {
        var hostName = host.name;
        var hostStatus = host.status;


        // if host is enabled and host is not a template
        if (parseInt(hostStatus) === 0) {

            // active ZBX item list
            if (parseInt(ItemList[i].type) === 7) {
                var row = {};
                row["hostid"] = ItemList[i].hostid;
                row["itemid"] = ItemList[i].itemid;
                activeItemList.push(row);
            }

            // disabled items on the top of enabled host
            if (parseInt(ItemList[i].status) === 1) {
                var row = {};
                row["hostid"] = ItemList[i].hostid;
                row["itemid"] = ItemList[i].itemid;
                row["name"] = hostName;
                disabledItems.push(row);
            }

            // items which are running (activated, not disabled) and item is not a prototype
            if (parseInt(ItemList[i].status) === 0 && (parseInt(ItemList[i].flags) === 0 || parseInt(ItemList[i].flags) === 4)) {
                var row = {};
                row["hostid"] = ItemList[i].hostid;
                row["itemid"] = ItemList[i].itemid;
                row["name"] = hostName;
                itemsAreRunning.push(row);

                // statistics about a item keys
                var row = {};
                row["key_"] = ItemList[i].key_;
                row["state"] = ItemList[i].state;
                row["name"] = hostName;
                ratioItemKeyWorking.push(row);


            }

            // unsupported and enabled items
            if (parseInt(ItemList[i].state) === 1 && ItemList[i].error !== '' && parseInt(ItemList[i].status) === 0) {
                var row = {};
                row["name"] = ItemList[i].name;
                row["itemid"] = ItemList[i].itemid;
                row["error"] = ItemList[i].error;
                row["hostid"] = ItemList[i].hostid;
                row["host"] = hostName;
                unsupportedItems.push(row);
            }
        }
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
        var item = LLDList[l];
        var host = hostMap[item.hostid];
        if (host) {
            row["host"] = host.name;
        }
        unsupportedLLDs.push(row);
    }
}


// Unsupported items by counts
Zabbix.Log(params.loglevel, "Zabbix API, Unsupported items by counts");
var countsU = {}; var unsupportedItemsCount = []; var i;
// Count occurrences
for (i = 0; i < unsupportedItems.length; i++) { var id = unsupportedItems[i].hostid; if (countsU[id]) { countsU[id]++ } else { countsU[id] = 1 } }
// Convert to desired output format
for (var id in countsU) { unsupportedItemsCount.push({ "hostid": id, "count": String(countsU[id]) }); }
// add host origin to unsupported items
var unsupportedItemsWithHost = [];
for (u in unsupportedItemsCount) {

    var item = unsupportedItemsCount[u];
    var host = hostMap[item.hostid];
    if (host) {
        var row = {};
        row["host"] = host.name;
        row["sort"] = unsupportedItemsCount[u].count;
        row["count"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=item.list&context=host&filter_hostids[]=' + host.hostid + '&filter_name=&filter_key=&filter_type=-1&filter_value_type=-1&filter_history=&filter_trends=&filter_delay=&filter_evaltype=0&filter_tags[0][tag]=&filter_tags[0][operator]=0&filter_tags[0][value]=&filter_state=1&filter_with_triggers=-1&filter_inherited=-1&filter_discovered=-1&filter_set=1\' target=\'_blank\'>' + unsupportedItemsCount[u].count + '</a>';
        unsupportedItemsWithHost.push(row);
    }

}
// sort by column "sort" with biggest numbers on top
unsupportedItemsWithHost.sort(function (a, b) { return Number(b.sort) - Number(a.sort); });
// delete "sort" column
for (var i = 0; i < unsupportedItemsWithHost.length; i++) { delete unsupportedItemsWithHost[i].sort; }



// All items by counts
Zabbix.Log(params.loglevel, "Zabbix API, All items by counts");
var countsA = {}; var allItemsCount = []; var i;
// Count occurrences
for (i = 0; i < itemsAreRunning.length; i++) { var id = itemsAreRunning[i].hostid; if (countsA[id]) { countsA[id]++ } else { countsA[id] = 1 } }
// Convert to desired output format
for (var id in countsA) { allItemsCount.push({ "hostid": id, "count": String(countsA[id]) }); }
// add host origin to all items
var itemsAreRunningWithHost = [];
for (u in allItemsCount) {

    var item = allItemsCount[u];
    var host = hostMap[item.hostid];
    if (host) {
        var row = {};
        row["host"] = host.name;
        row["sort"] = allItemsCount[u].count;
        row["count"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=item.list&context=host&filter_hostids[]=' + host.hostid + '&filter_name=&filter_key=&filter_type=-1&filter_value_type=-1&filter_history=&filter_trends=&filter_delay=&filter_evaltype=0&filter_tags[0][tag]=&filter_tags[0][operator]=0&filter_tags[0][value]=&filter_state=-1&filter_status=0&filter_with_triggers=-1&filter_inherited=-1&filter_discovered=-1&filter_set=1\' target=\'_blank\'>' + allItemsCount[u].count + '</a>';
        itemsAreRunningWithHost.push(row);
    }
}
// sort by column "sort" with biggest numbers on top
itemsAreRunningWithHost.sort(function (a, b) { return Number(b.sort) - Number(a.sort); });
// delete "sort" column
for (var i = 0; i < itemsAreRunningWithHost.length; i++) { delete itemsAreRunningWithHost[i].sort; }


// Disabled items by counts
Zabbix.Log(params.loglevel, "Zabbix API, Disabled items by counts");
var countsD = {}; var disabledItemsCount = []; var i;
// Count occurrences by hostid+name combination
for (i = 0; i < disabledItems.length; i++) {
    var hostid = disabledItems[i].hostid;
    var name = disabledItems[i].name;
    var key = hostid + "|" + name;
    if (countsD[key]) { countsD[key].count += 1; } else { countsD[key] = { hostid: hostid, name: name, count: 1 }; }
}
// Convert to disabledItemsCount array
for (var key in countsD) {
    var entry = countsD[key];
    disabledItemsCount.push({ hostid: entry.hostid, name: entry.name, count: String(entry.count) });
}
var disabledItemsWithHost = [];
for (u in disabledItemsCount) {
    var row = {};
    row["host"] = disabledItemsCount[u].name;
    row["sort"] = disabledItemsCount[u].count;
    row["count"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=item.list&context=host&filter_hostids[]=' + disabledItemsCount[u].hostid + '&filter_name=&filter_key=&filter_type=-1&filter_value_type=-1&filter_history=&filter_trends=&filter_delay=&filter_evaltype=0&filter_tags[1][tag]=&filter_tags[1][operator]=0&filter_tags[1][value]=&filter_state=-1&filter_status=1&filter_with_triggers=-1&filter_inherited=-1&filter_discovered=-1&filter_set=1\' target=\'_blank\'>' + disabledItemsCount[u].count + '</a>';
    disabledItemsWithHost.push(row);
}
// Sort by count descending
disabledItemsWithHost.sort(function (a, b) { return Number(b.sort) - Number(a.sort); });
// delete "sort" column
for (var i = 0; i < disabledItemsWithHost.length; i++) { delete disabledItemsWithHost[i].sort; }


// unsupported LLDs by count
var counts = {}; var unsupportedLLDsCount = []; var i;
// Count occurrences
for (i = 0; i < unsupportedLLDs.length; i++) { var id = unsupportedLLDs[i].hostid; if (counts[id]) { counts[id]++; } else { counts[id] = 1; } }
// Convert to desired output format
for (var id in counts) { unsupportedLLDsCount.push({ "hostid": id, "count": String(counts[id]) }); }
// add host origin to unsupported items
var unsupportedLLDsWithHost = [];
for (u in unsupportedLLDsCount) {
    var item = unsupportedLLDsCount[u];
    var host = hostMap[item.hostid];
    if (host) {
        var row = {};
        row["host"] = host.name;
        row["sort"] = unsupportedLLDsCount[u].count;
        row["count"] = '<a href=\'{$ZABBIX.URL}/host_discovery.php?context=host&filter_hostids[]=' + host.hostid + '&filter_name=&filter_key=&filter_type=-1&filter_delay=&filter_lifetime_type=-1&filter_enabled_lifetime_type=-1&filter_snmp_oid=&filter_state=1&filter_set=1\' target=\'_blank\'>' + unsupportedLLDsCount[u].count + '</a>';
        unsupportedLLDsWithHost.push(row);
    }
}
// sort by column "sort" with biggest numbers on top
unsupportedLLDsWithHost.sort(function (a, b) { return Number(b.sort) - Number(a.sort); });
// delete "sort" column
for (var i = 0; i < unsupportedLLDsWithHost.length; i++) { delete unsupportedLLDsWithHost[i].sort; }



// iterate through host objects which hosts "Zabbix agent (active)" items
Zabbix.Log(params.loglevel, "Zabbix API, extract unavailable and unknown ZBX active checks");

var activeUnavailable2 = [];
var activeUnknown0 = [];

// this holds only hostid's which run ZBX active items
for (a in onlyActiveHostList) {

    // need to map back with host name and proxy
    var host = hostMap[onlyActiveHostList[a]];
    if (host) {
        var proxy = proxyMap[host.proxyid];
        if (proxy) { proxyName = proxy.name; } else { proxyName = ''; }


        if (parseInt(host.active_available) === 2 && parseInt(host.hostid) === parseInt(onlyActiveHostList[a])) {
            var row = {};
            row["proxy"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=proxy.list&filter_name=' + proxyName + '&filter_operating_mode=-1&filter_version=-1&filter_set=1\' target=\'_blank\'>' + proxyName + '</a>';
            row["host"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=host.list&filter_host=' + host.name + '&filter_dns=&filter_ip=&filter_port=&filter_status=-1&filter_monitored_by=-1&filter_evaltype=0&filter_tags[0][tag]=&filter_tags[0][operator]=0&filter_tags[0][value]=&filter_set=1\' target=\'_blank\'>' + host.name + '</a>';
            activeUnavailable2.push(row);
        }
        if (parseInt(host.active_available) === 0 && parseInt(host.hostid) === parseInt(onlyActiveHostList[a])) {
            var row = {};
            row["proxy"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=proxy.list&filter_name=' + proxyName + '&filter_operating_mode=-1&filter_version=-1&filter_set=1\' target=\'_blank\'>' + proxyName + '</a>';
            row["host"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=host.list&filter_host=' + host.name + '&filter_dns=&filter_ip=&filter_port=&filter_status=-1&filter_monitored_by=-1&filter_evaltype=0&filter_tags[0][tag]=&filter_tags[0][operator]=0&filter_tags[0][value]=&filter_set=1\' target=\'_blank\'>' + host.name + '</a>';
            activeUnknown0.push(row);
        }
    }
}

// output will be an array
Zabbix.Log(params.loglevel, "Zabbix API, passive ZBX, SNMP, JMX interfaces");
var passiveNotWorking = [];
var passiveNotUsed = [];
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
            row["error"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=host.list&filter_host=' + hostList[h].name + '&filter_dns=&filter_ip=&filter_port=&filter_status=-1&filter_monitored_by=-1&filter_evaltype=0&filter_tags[0][tag]=&filter_tags[0][operator]=0&filter_tags[0][value]=&filter_set=1\' target=\'_blank\'>' + interfaceList[i].error + '</a>';


            if (interfaceList[i].error !== '') {
                row["host"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=host.edit&hostid=' + hostList[h].hostid + '\' target=\'_blank\'>' + hostList[h].name + '</a>';
                passiveNotWorking.push(row);
            } else {
                row["host"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=host.edit&hostid=' + hostList[h].hostid + '\' target=\'_blank\'>' + hostList[h].name + '</a>';
                passiveNotUsed.push(row);
            }
        }
    }

}

// for not used interfaces delete column "error"
for (var i = 0; i < passiveNotUsed.length; i++) { delete passiveNotUsed[i].error; }

var scriptEnded = Date.now() / 1000;

var visitItemRatio = [];
var BadPercentItems = calculateBadPercent(ratioItemKeyWorking);
for (b in BadPercentItems) {
        var row = {};
        row["ratio bad"] = BadPercentItems[b].bad;
        row["count"] = BadPercentItems[b].count;
        row["key"] = '<a href=\'{$ZABBIX.URL}/zabbix.php?action=item.list&context=host&filter_name=&filter_key=' + BadPercentItems[b].key_ + '&filter_type=-1&filter_value_type=-1&filter_history=&filter_trends=&filter_delay=&filter_evaltype=0&filter_tags%5B0%5D%5Btag%5D=&filter_tags%5B0%5D%5Boperator%5D=0&filter_tags%5B0%5D%5Bvalue%5D=&filter_state=-1&filter_status=-1&filter_with_triggers=-1&filter_inherited=-1&filter_discovered=-1&filter_set=1\' target=\'_blank\'>' + BadPercentItems[b].key_ + '</a>';
        visitItemRatio.push(row);
}

Zabbix.Log(params.loglevel, "Zabbix API, end and return");

return JSON.stringify({
    'triggersWithErrorsWithHost': triggersWithErrorsWithHost,
    'triggersWithErrors': triggersWithErrors,
    'triggerList': triggerList,
    'timeAPIfetching': (calculationStarts - scriptStarts),
    'timeAggregate': (scriptEnded - calculationStarts),
    'timeTotal': (scriptEnded - scriptStarts),
    'ratioItemKeyWorking': visitItemRatio,
    'disabledHosts': disabledHosts,
    'itemsAreRunningWithHost': itemsAreRunningWithHost,
    'passiveNotUsed': passiveNotUsed,
    'disabledItemsCount': disabledItemsCount,
    'unsupportedItemsCount': unsupportedItemsCount,
    'disabledItemsWithHost': disabledItemsWithHost,
    'unsupportedLLDsWithHost': unsupportedLLDsWithHost,
    'unsupportedItemsWithHost': unsupportedItemsWithHost,
    'unsupportedItems': unsupportedItems,
    'disabledItems': disabledItems,
    'passiveNotWorking': passiveNotWorking,
    'proxyList': proxyList,
    'onlyActiveHostList': onlyActiveHostList,
    'activeUnavailable2': activeUnavailable2,
    'activeUnknown0': activeUnknown0
});