import { pool } from '../src/db';
import { runMigrations } from '../src/migrate';

runMigrations()
    .then(() => console.log('Migration complete.'))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => pool.end());
