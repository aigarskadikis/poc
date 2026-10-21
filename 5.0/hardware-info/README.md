# Hardware info via DB query

## Prerequsites

| Zabbix                 | Agent             | MySQL           | PostgreSQL                  |
|------------------------|-------------------|-----------------|-----------------------------|
| 5.0.47                 | 5.0.47            | 8.0             | 18                          |


## Collector item keys in use

```
vfs.file.contents["/proc/cpuinfo" ,]
vfs.file.contents["/proc/net/fib_trie" ,]
vfs.file.contents["/proc/sys/kernel/hostname" ,]
vfs.file.contents["/proc/meminfo" , ]
vfs.file.contents["/etc/os-release" ,]
vfs.file.contents["/proc/partitions" ,]
```

## Extraction item keys (dependent items)

```
inventory.cpu.model
inventory.cpus
inventory.total.disk
inventory.hostname
inventory.ip.address
inventory.operating.system
inventory.mem
```

## PostgreSQL query

Host
```sql
WITH eligible_hosts AS (
  SELECT hostid, host, name FROM hosts WHERE status = 0 AND flags = 0
), inventory AS (
  SELECT i.hostid, i.key_, latest.value
  FROM items i JOIN eligible_hosts h USING (hostid)
  CROSS JOIN LATERAL (
    SELECT hs.value FROM history_str hs WHERE hs.itemid = i.itemid
    ORDER BY hs.clock DESC, hs.ns DESC LIMIT 1
  ) latest
  WHERE i.status = 0 AND i.flags = 0 AND i.key_ IN (
    'inventory.cpu.model', 'inventory.ip.address', 'inventory.hostname', 'inventory.operating.system'
  )
  UNION ALL
  SELECT i.hostid, i.key_, latest.value
  FROM items i JOIN eligible_hosts h USING (hostid)
  CROSS JOIN LATERAL (
    SELECT hu.value FROM history_uint hu WHERE hu.itemid = i.itemid
    ORDER BY hu.clock DESC, hu.ns DESC LIMIT 1
  ) latest
  WHERE i.status = 0 AND i.flags = 0 AND i.key_ IN (
    'inventory.mem', 'inventory.total.disk', 'inventory.cpus'
  )
), pivot AS (
  SELECT hostid,
    MAX(value) FILTER (WHERE key_ = 'inventory.cpu.model') AS cpu_model,
    MAX(value) FILTER (WHERE key_ = 'inventory.ip.address') AS ip_address,
    MAX(value) FILTER (WHERE key_ = 'inventory.operating.system') AS operating_system,
    TRUNC(MAX(value) FILTER (WHERE key_ = 'inventory.mem') / 1073741824) AS memory_gb,
    TRUNC(MAX(value) FILTER (WHERE key_ = 'inventory.total.disk') / 1073741824) AS disk_gb,
    MAX(value) FILTER (WHERE key_ = 'inventory.cpus') AS cpus
  FROM inventory GROUP BY hostid
)
SELECT h.host, h.name, p.cpu_model, p.ip_address, p.operating_system,
       p.memory_gb, p.disk_gb, p.cpus
FROM eligible_hosts h JOIN pivot p USING (hostid)
WHERE EXISTS (SELECT 1 FROM inventory i WHERE i.hostid = h.hostid)
ORDER BY h.name;
```

## MySQL query

Host
```sql
WITH hosts_ok AS (SELECT hostid, host, name FROM hosts WHERE status=0 AND flags=0),
sl AS (
  SELECT i.hostid, i.key_, hs.value, ROW_NUMBER() OVER (PARTITION BY i.itemid ORDER BY hs.clock DESC, hs.ns DESC) rn
  FROM items i JOIN hosts_ok h USING (hostid) JOIN history_str hs USING (itemid)
  WHERE i.status=0 AND i.flags=0 AND i.key_ IN ('inventory.cpu.model','inventory.ip.address','inventory.hostname','inventory.operating.system')
),
ul AS (
  SELECT i.hostid, i.key_, hu.value, ROW_NUMBER() OVER (PARTITION BY i.itemid ORDER BY hu.clock DESC, hu.ns DESC) rn
  FROM items i JOIN hosts_ok h USING (hostid) JOIN history_uint hu USING (itemid)
  WHERE i.status=0 AND i.flags=0 AND i.key_ IN ('inventory.mem','inventory.total.disk','inventory.cpus')
),
sp AS (
  SELECT hostid, MAX(CASE WHEN key_='inventory.cpu.model' THEN value END) cpu_model,
    MAX(CASE WHEN key_='inventory.ip.address' THEN value END) ip_address,
    MAX(CASE WHEN key_='inventory.operating.system' THEN value END) operating_system
  FROM sl WHERE rn=1 GROUP BY hostid
),
up AS (
  SELECT hostid, TRUNCATE(MAX(CASE WHEN key_='inventory.mem' THEN value END)/1073741824,0) memory_gb,
    TRUNCATE(MAX(CASE WHEN key_='inventory.total.disk' THEN value END)/1073741824,0) disk_gb,
    MAX(CASE WHEN key_='inventory.cpus' THEN value END) CPUs
  FROM ul WHERE rn=1 GROUP BY hostid
)
SELECT h.host, h.name, s.cpu_model, s.ip_address, s.operating_system, u.memory_gb, u.disk_gb, u.CPUs
FROM hosts_ok h LEFT JOIN sp s USING (hostid) LEFT JOIN up u USING (hostid)
WHERE EXISTS (SELECT 1 FROM items i WHERE i.hostid=h.hostid AND i.status=0 AND i.flags=0
  AND i.key_ IN ('inventory.cpu.model','inventory.ip.address','inventory.hostname','inventory.operating.system','inventory.mem','inventory.total.disk','inventory.cpus'))
ORDER BY h.name;
```
