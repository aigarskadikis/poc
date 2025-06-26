# Get CPU usage
$cpuData = Get-WmiObject Win32_PerfFormattedData_PerfProc_Process |
Where-Object { $_.Name -ne "_Total" -and $_.Name -ne "Idle" } |
Select-Object @{Name="BaseName"; Expression={($_.Name -split "#")[0]}}, IDProcess, PercentProcessorTime

# Get memory usage
$memData = Get-WmiObject Win32_Process |
Select-Object @{Name="BaseName"; Expression={($_.Name -split "#")[0]}}, ProcessId, @{Name="MemoryBytes";Expression={$_.WorkingSetSize}}

# Combine on Process ID
$combined = foreach ($cpu in $cpuData) {
    $mem = $memData | Where-Object { $_.ProcessId -eq $cpu.IDProcess }
    if ($mem) {
        [PSCustomObject]@{
            Name = $cpu.BaseName
            CPU = $cpu.PercentProcessorTime
            MemoryBytes = $mem.MemoryBytes
        }
    }
}

# Group by process name and sum CPU and memory
$aggregated = $combined |
Group-Object Name |
ForEach-Object {
    [PSCustomObject]@{
        Name = $_.Name
        TotalCPU = ($_.Group | Measure-Object CPU -Sum).Sum
        TotalMemoryBytes = ($_.Group | Measure-Object MemoryBytes -Sum).Sum
    }
}

# Convert top 10 by memory to JSON
$aggregated |
Sort-Object TotalMemoryBytes -Descending |
ConvertTo-Json -Depth 2