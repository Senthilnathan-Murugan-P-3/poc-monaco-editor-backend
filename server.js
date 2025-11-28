// server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');  // Note: Capital 'P' in Pool

const app = express();
const port = 3000;

// PostgreSQL connection pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'monaco_db',
  password: 'p3@123',
  port: 5432,
});

// Middleware
app.use(cors());
app.use(express.json());

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SQL Editor API Server',
    status: 'running',
    endpoints: {
      tables: 'GET /api/tables',
      searchColumns: 'POST /api/columns/search',
      executeQuery: 'POST /api/query/execute',
    }
  });
});



// API to search columns across ALL tables based on user typing
app.post('/api/columns/search-all', async (req, res) => {
  try {
    const { searchTerm = '' } = req.body;
    
    console.log(`🔍 Searching columns across all tables with: "${searchTerm}"`);
    
    // Get columns from ALL tables that match the search term
    const query = `
      SELECT 
        table_name,
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name ILIKE $1
      ORDER BY table_name, ordinal_position;
    `;
    
    const searchPattern = searchTerm ? `%${searchTerm}%` : '%';
    const result = await pool.query(query, [searchPattern]);
    
    console.log(`✅ Found ${result.rows.length} columns across all tables`);
    
    res.json({
      columns: result.rows.map(row => ({
        name: row.column_name,
        table: row.table_name,
        data_type: row.data_type,
        nullable: row.is_nullable === 'YES'
      }))
    });
  } catch (error) {
    console.error('Error searching columns:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// API to get column suggestions based on user typing (for specific table)
app.post('/api/columns/search', async (req, res) => {
  try {
    const { searchTerm = '', tableName } = req.body;
    
    console.log(`🔍 Searching columns: table="${tableName}", search="${searchTerm}"`);
    
    if (!tableName) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    // Get columns for the specified table that match the search term
    const query = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name ILIKE $2
      ORDER BY ordinal_position;
    `;
    
    const searchPattern = searchTerm ? `%${searchTerm}%` : '%';
    const result = await pool.query(query, [tableName, searchPattern]);
    
    console.log(`✅ Found ${result.rows.length} columns`);
    
    res.json({
      columns: result.rows.map(row => ({
        name: row.column_name,
        data_type: row.data_type,
        nullable: row.is_nullable === 'YES'
      }))
    });
  } catch (error) {
    console.error('Error fetching columns:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});


// API to search tables based on user typing
app.post('/api/tables/search', async (req, res) => {
  try {
    const { searchTerm = '' } = req.body;
    
    console.log(`🔍 Searching tables with: "${searchTerm}"`);
    
    // Get tables that match the search term
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name ILIKE $1
      ORDER BY table_name;
    `;
    
    const searchPattern = searchTerm ? `%${searchTerm}%` : '%';
    const result = await pool.query(query, [searchPattern]);
    
    console.log(`✅ Found ${result.rows.length} tables`);
    
    res.json({
      tables: result.rows.map(row => row.table_name)
    });
  } catch (error) {
    console.error('Error searching tables:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});


// API to execute SELECT queries (with safety checks)
app.post('/api/query/execute', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Basic security: only allow SELECT queries
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery.startsWith('select')) {
      return res.status(403).json({ 
        error: 'Only SELECT queries are allowed' 
      });
    }

    const result = await pool.query(query);
    
    res.json({
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields.map(field => ({
        name: field.name,
        dataType: field.dataTypeID
      }))
    });
  } catch (error) {
    console.error('Query execution error:', error);
    res.status(400).json({ 
      error: 'Query execution failed',
      message: error.message 
    });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});