import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
}

export async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);
  
  // Set a timeout to prevent client leaks
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
  }, 5000);
  
  client.query = (...args) => {
    return originalQuery(...args);
  };
  
  client.release = () => {
    clearTimeout(timeout);
    originalRelease();
  };
  
  return client;
}

export async function initDatabase() {
  console.log('Initializing database schema...');
  
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    // Create recipes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS recipes (
        id VARCHAR(21) PRIMARY KEY,
        title TEXT NOT NULL,
        image TEXT,
        author TEXT,
        source_name TEXT,
        source_url TEXT NOT NULL,
        category TEXT,
        is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
        yield TEXT,
        servings INTEGER,
        times JSONB,
        ingredients JSONB NOT NULL,
        steps JSONB NOT NULL,
        tips JSONB,
        notes TEXT,
        nutrition JSONB,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `);

    // Lightweight migrations for existing deployments (CREATE TABLE IF NOT EXISTS won't add new columns)
    await client.query(`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS category TEXT`);
    await client.query(`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE`);
    
    // Create cook sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS cook_sessions (
        id SERIAL PRIMARY KEY,
        recipe_id VARCHAR(21) NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        checked_ingredients JSONB NOT NULL DEFAULT '{}',
        checked_steps JSONB NOT NULL DEFAULT '{}',
        multiplier NUMERIC NOT NULL DEFAULT 1,
        expires_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `);
    
    // Create settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value JSONB NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `);
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recipes_is_favorite ON recipes(is_favorite)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cook_sessions_recipe_id ON cook_sessions(recipe_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cook_sessions_expires_at ON cook_sessions(expires_at)
    `);
    
    await client.query('COMMIT');
    console.log('✓ Database schema initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Helper function to convert snake_case to camelCase for JS
function toCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  return Object.keys(obj).reduce((acc, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    acc[camelKey] = toCamelCase(obj[key]);
    return acc;
  }, {});
}

// Helper function to convert camelCase to snake_case for DB
function toSnakeCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  return Object.keys(obj).reduce((acc, key) => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    acc[snakeKey] = toSnakeCase(obj[key]);
    return acc;
  }, {});
}

export { toCamelCase, toSnakeCase };
