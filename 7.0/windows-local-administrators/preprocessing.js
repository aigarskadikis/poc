var users = JSON.parse(value);
var out = [];
for (i = 0; i < users.length; i++) {
   var row = {};
   row["object"] = users[i].PartComponent.match(/Name=[\\"]+([^\\"]+)[\\"]+/)[1];
   out.push(row);
}
if (out.length > 1) {
   return JSON.stringify(out.sort());
} else {
   return JSON.stringify(out);
}