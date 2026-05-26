#!/bin/bash
cd table-serve-backend
bun run src/db/migrate.ts && bun run src/index.ts
