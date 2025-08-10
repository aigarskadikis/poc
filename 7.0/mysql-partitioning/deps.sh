# for alma linux 8
systemctl disable --now zabbix-server
dnf --enablerepo=powertools -y install perl-DateTime wget perl-DBI perl-Sys-Syslog perl-DBD-mysql vim
cd /usr/local/bin
wget https://raw.githubusercontent.com/OpensourceICTSolutions/zabbix-mysql-partitioning-perl/5f3e78ee90b1f18cc00099f3a3deda45eb9f76bd/mysql_zbx_part.pl
chmod +x mysql_zbx_part.pl
grep ^DB /etc/zabbix/zabbix_server.conf

systemctl enable --now zabbix-server
tail -99f /var/log/zabbix/zabbix_server.log

echo '55 22 * * * root /usr/local/bin/mysql_zbx_part.pl >/dev/null 2>&1' | sudo tee /etc/cron.d/mysql_zbx_part