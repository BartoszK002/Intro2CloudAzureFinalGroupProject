// api.js
const sql = require('mssql');

// Configuration with connection pooling
const config = {
    server: 'retail-server-finalproj.database.windows.net',
    database: 'RetailDB',
    authentication: {
        type: 'default',
        options: {
            userName: 'finalprojfs24',
            password: 'finalProject100A$'
        }
    },
    options: {
        encrypt: true,
        trustServerCertificate: false
    },
    pool: {
        min: 0,
        max: 10,
        idleTimeoutMillis: 30000
    }
};

// Create a connection pool
const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

// Handle pool errors
pool.on('error', err => {
    console.error('SQL Pool Error:', err);
});

async function searchHousehold(hshdNum) {
    try {
        await poolConnect;
        const result = await pool.request()
            .input('hshdNum', sql.Int, hshdNum)
            .query(`
                SELECT 
                    h.HSHD_NUM,
                    t.BASKET_NUM,
                    t.PURCHASE_ as Date,
                    t.PRODUCT_NUM,
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
                    t.PRODUCT_NUM,
                    p.DEPARTMENT,
                    p.COMMODITY
            `);
        return result.recordset;
    } catch (err) {
        console.error('Database Error:', err);
        throw new Error('Failed to fetch household data');
    }
}

// Graceful shutdown function
async function closePool() {
    try {
        await pool.close();
        console.log('Pool closed successfully');
    } catch (err) {
        console.error('Error closing pool:', err);
        throw err;
    }
}

module.exports = { 
    searchHousehold,
    closePool
};
