const express = require('express');
const sql = require('mssql');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const api = require('./api');

const app = express();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware for parsing JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static('public'));

// Logging middleware for all requests
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log('REQUEST LOG:', JSON.stringify({
        timestamp,
        method: req.method,
        url: req.url,
        params: req.params,
        query: req.query,
        headers: req.headers,
        ip: req.ip
    }, null, 2));
    next();
});

// Error logging function
function logError(context, error) {
    const timestamp = new Date().toISOString();
    const errorDetails = {
        timestamp,
        context,
        message: error.message,
        stack: error.stack,
        code: error.code,
        state: error.state,
        number: error.number,
        lineNumber: error.lineNumber,
        procedureName: error.procedureName
    };
    console.error('ERROR LOG:', JSON.stringify(errorDetails, null, 2));
    return errorDetails;
}

// Debug logging function
function logDebug(context, message, data = {}) {
    const timestamp = new Date().toISOString();
    const debugInfo = {
        timestamp,
        context,
        message,
        data
    };
    console.log('DEBUG LOG:', JSON.stringify(debugInfo, null, 2));
}

// Household search endpoint
app.get('/api/household/:hshdNum', async (req, res) => {
    const context = `GET /api/household/${req.params.hshdNum}`;
    try {
        logDebug(context, 'Processing request', { 
            params: req.params,
            query: req.query 
        });
        
        const hshdNum = parseInt(req.params.hshdNum);
        if (isNaN(hshdNum)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid household number. Please enter a valid number.',
                details: 'Household number must be a valid integer'
            });
        }

        const data = await api.searchHousehold(hshdNum);
        
        logDebug(context, 'Search completed', {
            rowCount: data.length,
            firstRow: data[0] ? 'Data found' : 'No data found'
        });

        if (!data || data.length === 0) {
            return res.status(200).json({
                success: false,
                message: `Household #${hshdNum} was not found in the current datasets.`,
                data: []
            });
        }

        res.json({
            success: true,
            message: `Found ${data.length} records for household #${hshdNum}`,
            data: data
        });
    } catch (err) {
        const errorDetails = logError(context, err);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching the household data.',
            error: err.message || 'Failed to fetch household data',
            details: errorDetails
        });
    }
});

// File upload endpoint
app.post('/api/upload', upload.fields([
    { name: 'households', maxCount: 1 },
    { name: 'transactions', maxCount: 1 },
    { name: 'products', maxCount: 1 }
]), async (req, res) => {
    const context = 'POST /api/upload';
    try {
        if (!req.files) {
            throw new Error('No files uploaded');
        }

        // Process each file
        const results = {
            households: [],
            transactions: [],
            products: []
        };

        // Read and parse CSV files
        for (const fileType of ['households', 'transactions', 'products']) {
            const file = req.files[fileType][0];
            results[fileType] = await new Promise((resolve, reject) => {
                const data = [];
                fs.createReadStream(file.path)
                    .pipe(csv())
                    .on('data', (row) => data.push(row))
                    .on('end', () => resolve(data))
                    .on('error', reject);
            });
        }

        // Process the data using API functions
        await api.processHouseholds(results.households);
        await api.processTransactions(results.transactions);
        await api.processProducts(results.products);

        // Clean up uploaded files
        for (const fileType of ['households', 'transactions', 'products']) {
            fs.unlinkSync(req.files[fileType][0].path);
        }

        res.json({ 
            message: 'Files uploaded and processed successfully',
            recordCounts: {
                households: results.households.length,
                transactions: results.transactions.length,
                products: results.products.length
            }
        });
    } catch (err) {
        logError(context, err);
        res.status(500).json({
            error: 'Upload failed',
            message: err.message
        });
    }
});

// Modify the dashboard endpoint
app.get('/api/dashboard', async (req, res) => {
    const context = 'GET /api/dashboard';
    try {
        // Check if database is ready
        if (!api.isPoolReady()) {
            logDebug(context, 'Waiting for database connection...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay
            if (!api.isPoolReady()) {
                throw new Error('Database connection not ready');
            }
        }

        const data = await api.getDashboardData();
        logDebug(context, 'Dashboard data fetched successfully');
        res.json(data);
    } catch (error) {
        logError(context, error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch dashboard data',
            error: error.message
        });
    }
});

// Add health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        // Use the existing pool from api.js
        if (!api.isPoolReady()) {
            throw new Error('Database pool not ready');
        }
        await api.pool.request().query('SELECT 1');
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({ status: 'error', message: 'Database not ready' });
    }
});

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Data page route
app.get('/data', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'data.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    const errorDetails = logError('Global Error Handler', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred',
        details: errorDetails
    });
});

// Handle 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
    logDebug('Server', `Server is running on port ${port}`);
});
