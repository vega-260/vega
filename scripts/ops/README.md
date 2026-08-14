# VEGA database operations

These scripts provide a minimum operational backup/restore path for self-managed MySQL. Managed production databases should additionally enable provider snapshots and point-in-time recovery.

- `backup-mysql.sh` uses a transaction-consistent `mysqldump`, compresses it, verifies gzip integrity, and applies local retention.
- `restore-mysql.sh` validates a gzip backup before restoring it.

Do not store backups inside the application container. Mount a durable encrypted volume or upload verified backups to restricted object storage from your infrastructure pipeline.
