#!/bin/bash
# Move to the project root directory
# cd "$(dirname "$0")/.."
echo "Starting the migration process..."
echo "Running Knex migrations..."
# Run the Knex migration Exported DB access is already expected to be available for src/database/knexfile.ts
npm run knex migrate:latest
echo "Migration process completed."
