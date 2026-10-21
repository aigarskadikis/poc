# Hardware info via DB query

## Prerequsites

| Zabbix                 | Agent             | MySQL           | PostgreSQL                  |
|------------------------|-------------------|-----------------|-----------------------------|
| 5.0.47                 | 5.0.47            | 8.0             | 18                          |


## PostgreSQL query

Host
```sql
WITH
  eligible_hosts AS (
    SELECT
      hostid,
      HOST,
      name
    FROM
      hosts
    WHERE
      status = 0
      AND flags = 0
  ),
  string_inventory AS (
    SELECT
      i.hostid,
      i.key_,
      latest.value
    FROM
      items i
      JOIN eligible_hosts h ON h.hostid = i.hostid
      JOIN LATERAL (
        SELECT
          hs.value
        FROM
          history_str hs
        WHERE
          hs.itemid = i.itemid
        ORDER BY
          hs.clock DESC,
          hs.ns DESC
        LIMIT
          1
      ) latest ON TRUE
    WHERE
      i.status = 0
      AND i.flags = 0
      AND i.key_ IN (
        'inventory.cpu.model',
        'inventory.ip.address',
        'inventory.hostname',
        'inventory.operating.system'
      )
  ),
  uint_inventory AS (
    SELECT
      i.hostid,
      i.key_,
      latest.value
    FROM
      items i
      JOIN eligible_hosts h ON h.hostid = i.hostid
      JOIN LATERAL (
        SELECT
          hu.value
        FROM
          history_uint hu
        WHERE
          hu.itemid = i.itemid
        ORDER BY
          hu.clock DESC,
          hu.ns DESC
        LIMIT
          1
      ) latest ON TRUE
    WHERE
      i.status = 0
      AND i.flags = 0
      AND i.key_ IN (
        'inventory.mem',
        'inventory.total.disk',
        'inventory.cpus'
      )
  ),
  string_pivot AS (
    SELECT
      hostid,
      MAX(value) FILTER (
        WHERE
          key_ = 'inventory.cpu.model'
      ) AS cpu_model,
      MAX(value) FILTER (
        WHERE
          key_ = 'inventory.hostname'
      ) AS hostname,
      MAX(value) FILTER (
        WHERE
          key_ = 'inventory.ip.address'
      ) AS ip_address,
      MAX(value) FILTER (
        WHERE
          key_ = 'inventory.operating.system'
      ) AS operating_system
    FROM
      string_inventory
    GROUP BY
      hostid
  ),
  uint_pivot AS (
    SELECT
      hostid,
      TRUNC(
        MAX(value) FILTER (
          WHERE
            key_ = 'inventory.mem'
        ) / 1024 / 1024 / 1024
      ) AS memory_gb,
      TRUNC(
        MAX(value) FILTER (
          WHERE
            key_ = 'inventory.total.disk'
        ) / 1024 / 1024 / 1024
      ) AS disk_gb,
      MAX(value) FILTER (
        WHERE
          key_ = 'inventory.cpus'
      ) AS CPUs
    FROM
      uint_inventory
    GROUP BY
      hostid
  )
SELECT
  h.host,
  h.name,
  s.cpu_model,
  s.ip_address,
  s.operating_system,
  u.memory_gb,
  u.disk_gb,
  u.CPUs
FROM
  eligible_hosts h
  LEFT JOIN string_pivot s ON s.hostid = h.hostid
  LEFT JOIN uint_pivot u ON u.hostid = h.hostid
WHERE
  EXISTS (
    SELECT
      1
    FROM
      items i
    WHERE
      i.hostid = h.hostid
      AND i.status = 0
      AND i.flags = 0
      AND i.key_ IN (
        'inventory.cpu.model',
        'inventory.ip.address',
        'inventory.hostname',
        'inventory.operating.system',
        'inventory.mem',
        'inventory.total.disk',
        'inventory.cpus'
      )
  )
ORDER BY
  h.name;
```

## MySQL query

Host
```sql
WITH eligible_hosts AS (
    SELECT hostid, host, name
    FROM hosts WHERE status = 0 AND flags = 0
),
string_latest AS (
    SELECT i.hostid, i.key_, hs.value,
           ROW_NUMBER() OVER (
               PARTITION BY i.itemid
               ORDER BY hs.clock DESC, hs.ns DESC
           ) rn
    FROM items i
    JOIN eligible_hosts h ON h.hostid = i.hostid
    JOIN history_str hs ON hs.itemid = i.itemid
    WHERE i.status = 0 AND i.flags = 0
      AND i.key_ IN ('inventory.cpu.model','inventory.ip.address',
      'inventory.hostname','inventory.operating.system')
),
uint_latest AS (
    SELECT i.hostid, i.key_, hu.value,
           ROW_NUMBER() OVER (
               PARTITION BY i.itemid
               ORDER BY hu.clock DESC, hu.ns DESC
           ) rn
    FROM items i
    JOIN eligible_hosts h ON h.hostid = i.hostid
    JOIN history_uint hu ON hu.itemid = i.itemid
    WHERE i.status = 0 AND i.flags = 0
      AND i.key_ IN ('inventory.mem','inventory.total.disk','inventory.cpus')
),
string_pivot AS (
    SELECT hostid,
        MAX(CASE WHEN key_ = 'inventory.cpu.model' THEN value END) cpu_model,
        MAX(CASE WHEN key_ = 'inventory.hostname' THEN value END) hostname,
        MAX(CASE WHEN key_ = 'inventory.ip.address' THEN value END) ip_address,
        MAX(CASE WHEN key_ = 'inventory.operating.system' THEN value END) operating_system
    FROM string_latest WHERE rn = 1
    GROUP BY hostid
),
uint_pivot AS (
    SELECT hostid,
        TRUNCATE(MAX(CASE WHEN key_ = 'inventory.mem' THEN value END) / 1073741824, 0) memory_gb,
        TRUNCATE(MAX(CASE WHEN key_ = 'inventory.total.disk' THEN value END) / 1073741824, 0) disk_gb,
        MAX(CASE WHEN key_ = 'inventory.cpus' THEN value END) CPUs
    FROM uint_latest WHERE rn = 1
    GROUP BY hostid
)
SELECT h.host, h.name, s.cpu_model, s.ip_address,
       s.operating_system, u.memory_gb, u.disk_gb, u.CPUs
FROM eligible_hosts h
LEFT JOIN string_pivot s ON s.hostid = h.hostid
LEFT JOIN uint_pivot u ON u.hostid = h.hostid
WHERE EXISTS (
    SELECT 1 FROM items i
    WHERE i.hostid = h.hostid AND i.status = 0 AND i.flags = 0
      AND i.key_ IN ('inventory.cpu.model','inventory.ip.address','inventory.hostname',
      'inventory.operating.system','inventory.mem','inventory.total.disk','inventory.cpus')
)
ORDER BY h.name;
```
