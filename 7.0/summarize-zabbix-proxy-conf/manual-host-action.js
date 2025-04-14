var params = JSON.parse(value);

token = '{$Z_API_SESSIONID}';
url = '{$ZABBIX.URL}' + '/api_jsonrpc.php';
host = '{$HOST.HOST}';
script = '{$SCRIPT.NAME}';

var request = new HttpRequest();
request.addHeader('Content-Type: application/json');
request.addHeader('Authorization: Bearer ' + token);

// fetch all possible scripts
var allScripts = JSON.parse(request.post(url,
    '{"jsonrpc":"2.0","method":"script.get","params":{"output":["scriptid","name"]},"id":1}'
)).result;

// fetch all host IDs
var allHosts = JSON.parse(request.post(url,
    '{"jsonrpc":"2.0","method":"host.get","params":{"output":["hostid","host"]},"id":1}'
)).result;

// find hostid
var hostid = 0;
for (var n = 0; n < allHosts.length; n++) {
    if (allHosts[n].host === host) {
        hostid = parseInt(allHosts[n].hostid); break;
    }
}

// find scriptid
var scriptid = 0;
for (var n = 0; n < allScripts.length; n++) {
    if (allScripts[n].name === script) {
        scriptid = parseInt(allScripts[n].scriptid); break;
    }
}

// execute and save outcome as txt
result = '';
if (scriptid > 0) {
    var result = JSON.parse(request.post(url,
        '{"jsonrpc":"2.0","method":"script.execute","params":{"scriptid":"' + scriptid + '","hostid":"' + hostid + '"},"id":1}'
    )).result;
}

// print debug summary
return JSON.stringify({
    'allScripts': allScripts,
    'scriptid': scriptid,
    'result': result
});