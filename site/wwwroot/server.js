const express = require('express');
const sql = require('mssql');
const path = require('path');

const app = express();

// Database configuration
const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true
    }
};


// Serve static files from the public directory
app.use(express.static('public'));

// Create a connection pool
const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

// Update the API endpoint to use the pool
app.get('/api/household/:hshdNum', async (req, res) => {
    try {
        // Ensure pool is connected
        await poolConnect;
        
        const hshdNum = parseInt(req.params.hshdNum);
        const request = pool.request();
        
        const result = await request
            .input('hshdNum', sql.Int, hshdNum)
            .query(`
                SELECT 
                    h.HSHD_NUM,
                    t.BASKET_NUM,
                    t.PURCHASE_ as Date,
                    p.PRODUCT_NUM,
                    p.DEPARTMENT,
                    p.COMMODITY,
                    t.SPEND,
                    t.UNITS,
                    t.STORE_R as STORE_REGION,
                    t.WEEK_NUM,
                    t.YEAR,
                    h.L as LOYALTY_FLAG,
                    h.AGE_RANGE,
                    h.MARITAL as MARITAL_STATUS,
                    h.INCOME_RANGE,
                    h.HOMEOWNER as HOMEOWNER_DESC,
                    h.HSHD_COMPOSITION,
                    h.HH_SIZE as HSHD_SIZE,
                    h.CHILDREN
                FROM Households h
                JOIN Transactions t ON h.HSHD_NUM = t.HSHD_NUM
                JOIN Products p ON t.PRODUCT_NUM = p.PRODUCT_NUM
                WHERE h.HSHD_NUM = @hshdNum
                ORDER BY 
                    h.HSHD_NUM,
                    t.BASKET_NUM,
                    t.PURCHASE_,
                    p.PRODUCT_NUM,
                    p.DEPARTMENT,
                    p.COMMODITY
            `);
        
        res.json(result.recordset);
    } catch (err) {
        console.error('Database Error:', err);
        res.status(500).json({ error: 'Database error', details: err.message });
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

// Handle 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
