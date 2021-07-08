// convert text to JSON object and open the 'result' tree
var jsonData = JSON.parse(value).data.result;

// count how many elements are in JSON array
var lenghtOfArray=jsonData.length;

// define a new destination array with name 'lld'
var lld = [];

// start a loop to prepare LLD for Zabbix
for(var el = 0; el < lenghtOfArray; el++){

// create a new row in destination array
var row = {};

row["{#POD}"] = jsonData[el].metric.pod;
row["{#NAME}"] = jsonData[el].metric.name;
row["{#ID}"] = jsonData[el].metric.id;


// publish row
lld.push(row);

}


// return JSON.stringify(jsonData);
return '{"data":'+JSON.stringify(lld)+'}';
