var files = JSON.parse(value);

// what time is it right now
var now = new Date();

// function required to add zeros on the left side
function padLeft(value, length, char) {
    value = String(value);
    while (value.length < length) { value = char + value; }
    return value;
}

// define format
var year = now.getFullYear().toString(),
    month = padLeft(now.getMonth() + 1, 2, '0'),
    date = padLeft(now.getDate(), 2, '0'),
    hour = padLeft(now.getHours(), 2, '0'),
    minute = padLeft(now.getMinutes(), 2, '0'),
    seconds = padLeft(now.getSeconds(), 2, '0');

// define pattern for filename "zabbix_part_postgres_2025_04_19.log", :
var pattern = 'zabbix_part_postgres_' + year + '_' + month + '_' + date + '.log';

// iterate through all filenames
var output = [];
for (f in files) {
    if (files[f].basename.replace(/_[0-9]{4}\.log$/,'.log') === pattern) {
        output.push(files[f]);
        break;
    }
}

if (output) {
    return JSON.stringify(output);
} else {
    return '[]'
}