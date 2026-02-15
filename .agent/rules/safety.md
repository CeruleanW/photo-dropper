---
trigger: always_on
---

1. Before performing any destructive action (like rm or git reset), create a backup in a .backup/ folder.

2. If a command fails 3 times in a row, stop and wait for my review instead of looping.

3. Do not modify any files in the .config/ or .env directories.