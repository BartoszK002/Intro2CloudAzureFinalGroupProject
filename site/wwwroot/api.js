// api.js
const sql = require('mssql');

// Configuration with connection pooling
const config = {
    server: process.env.DB_SERVER || 'retail-server-finalproj.database.windows.net',
    database: process.env.DB_DATABASE || 'RetailDB',
    user: process.env.DB_USER || 'finalprojfs24',
    password: process.env.DB_PASSWORD || 'finalProject100A',
    options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true
    },
    pool: {
        min: 0,
        max: 10,
        idleTimeoutMillis: 30000
    }
};

let pool = null;
let poolReady = false;
let connectionRetries = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const IDLE_CHECK_INTERVAL = 60000; // Check connection every minute
let connectionCheckInterval;

async function ensureConnection() {
    const context = 'ensureConnection';
    
    if (poolReady && pool) {
        try {
            // Test the connection
            await pool.request().query('SELECT 1');
            return true;
        } catch (err) {
            logError(context, 'Connection test failed, will reconnect');
            poolReady = false;
        }
    }

    while (connectionRetries < MAX_RETRIES) {
        try {
            if (pool) {
                try {
                    await pool.close();
                } catch (err) {
                    logError(context, 'Error closing existing pool');
                }
            }

            pool = new sql.ConnectionPool(config);
            await pool.connect();
            poolReady = true;
            connectionRetries = 0;
            logDebug(context, 'Database connection established successfully');
            return true;
        } catch (err) {
            connectionRetries++;
            logError(context, `Connection attempt ${connectionRetries} failed: ${err.message}`);
            if (connectionRetries < MAX_RETRIES) {
                logDebug(context, `Waiting ${RETRY_DELAY}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }

    throw new Error(`Failed to establish database connection after ${MAX_RETRIES} attempts`);
}

// Replace the existing pool initialization with this
ensureConnection().catch(err => {
    logError('Initial Connection', err);
});

// Enhanced error logging function
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

// Enhanced debug logging function
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

// Handle pool errors with enhanced logging
pool.on('error', err => {
    logError('SQL Pool Error', err);
});

// Add these schema definitions at the top of api.js
const TABLE_SCHEMAS = {
    Households: {
        HSHD_NUM: sql.Int,
        L: sql.Char(1),
        AGE_RANGE: sql.VarChar(100),
        MARITAL: sql.VarChar(100),
        INCOME_RANGE: sql.VarChar(100),
        HOMEOWNER: sql.VarChar(100),
        HSHD_COMPOSITION: sql.VarChar(100),
        HH_SIZE: sql.VarChar(100),
        CHILDREN: sql.VarChar(100)
    },
    Transactions: {
        HSHD_NUM: sql.Int,
        BASKET_NUM: sql.VarChar(100),
        PURCHASE: sql.Date,
        PRODUCT_NUM: sql.Int,
        SPEND: sql.Decimal(10, 2),
        UNITS: sql.Int,
        STORE_R: sql.VarChar(100),
        WEEK_NUM: sql.Int,
        YEAR: sql.Int
    },
    Products: {
        PRODUCT_NUM: sql.Int,
        DEPARTMENT: sql.VarChar(100),
        COMMODITY: sql.VarChar(100),
        BRAND_TY: sql.VarChar(100),
        NATURAL_ORGANIC_FLAG: sql.Char(1)
    }
};

async function searchHousehold(hshdNum) {
    const context = `searchHousehold(${hshdNum})`;
    try {
        await ensureConnection();
        
        logDebug(context, 'Starting household search', { hshdNum });
        
        // First check if household exists
        const checkQuery = `
            SELECT HSHD_NUM 
            FROM Households 
            WHERE HSHD_NUM = @hshdNum`;

        const checkResult = await pool.request()
            .input('hshdNum', sql.Int, hshdNum)
            .query(checkQuery);

        if (checkResult.recordset.length === 0) {
            logDebug(context, 'Household not found', { hshdNum });
            return [];
        }

        const query = `
            SELECT 
                h.HSHD_NUM,
                t.BASKET_NUM,
                CONVERT(varchar, t.PURCHASE, 23) as PURCHASE,
                t.PRODUCT_NUM,
                COALESCE(NULLIF(TRIM(p.DEPARTMENT), ''), 'N/A') as DEPARTMENT,
                COALESCE(NULLIF(TRIM(p.COMMODITY), ''), 'N/A') as COMMODITY,
                t.SPEND,
                t.UNITS,
                COALESCE(NULLIF(RTRIM(t.STORE_R), ''), 'N/A') as STORE_REGION,
                t.WEEK_NUM,
                t.YEAR,
                COALESCE(NULLIF(h.L, ''), 'N/A') as LOYALTY_FLAG,
                COALESCE(NULLIF(TRIM(h.AGE_RANGE), ''), 'N/A') as AGE_RANGE,
                COALESCE(NULLIF(TRIM(h.MARITAL), ''), 'N/A') as MARITAL_STATUS,
                COALESCE(NULLIF(TRIM(h.INCOME_RANGE), ''), 'N/A') as INCOME_RANGE,
                COALESCE(NULLIF(TRIM(h.HOMEOWNER), ''), 'N/A') as HOMEOWNER_DESC,
                COALESCE(NULLIF(TRIM(h.HSHD_COMPOSITION), ''), 'N/A') as HSHD_COMPOSITION,
                COALESCE(NULLIF(TRIM(h.HH_SIZE), ''), 'N/A') as HSHD_SIZE,
                CASE 
                    WHEN h.CHILDREN IS NULL OR TRIM(h.CHILDREN) = '' OR h.CHILDREN = 'null' THEN 'N/A'
                    ELSE h.CHILDREN 
                END as CHILDREN,
                COALESCE(NULLIF(p.BRAND_TY, ''), 'N/A') as BRAND_TY,
                COALESCE(NULLIF(p.NATURAL_ORGANIC_FLAG, ''), 'N/A') as NATURAL_ORGANIC_FLAG
            FROM Households h
            LEFT JOIN Transactions t ON h.HSHD_NUM = t.HSHD_NUM
            LEFT JOIN Products p ON t.PRODUCT_NUM = p.PRODUCT_NUM
            WHERE h.HSHD_NUM = @hshdNum
            ORDER BY 
                h.HSHD_NUM,
                t.BASKET_NUM,
                t.PURCHASE,
                t.PRODUCT_NUM,
                p.DEPARTMENT,
                p.COMMODITY`;

        logDebug(context, 'Executing query', { query });

        const result = await pool.request()
            .input('hshdNum', sql.Int, hshdNum)
            .query(query);

        logDebug(context, 'Query executed successfully', { 
            rowCount: result.recordset.length,
            firstRow: result.recordset[0] ? 'Data found' : 'No data found'
        });

        return result.recordset;
    } catch (err) {
        logError(context, err);
        throw err;
    }
}

async function processHouseholds(data) {
    const context = 'processHouseholds';
    try {
        logDebug(context, 'Processing households data', { rowCount: data.length });
        
        await ensureConnection();

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Clear existing data
            await transaction.request().query('DELETE FROM Households');

            // Prepare bulk insert
            const table = new sql.Table('Households');
            
            // Add columns according to schema
            Object.entries(TABLE_SCHEMAS.Households).forEach(([column, type]) => {
                table.columns.add(column, type, { nullable: true });
            });

            // Add rows with proper data type conversion
            data.forEach(row => {
                table.rows.add(
                    parseInt(row.HSHD_NUM) || null,
                    row.L || null,
                    row.AGE_RANGE || null,
                    row.MARITAL || null,
                    row.INCOME_RANGE || null,
                    row.HOMEOWNER || null,
                    row.HSHD_COMPOSITION || null,
                    row.HH_SIZE || null,
                    row.CHILDREN || null
                );
            });

            // Perform bulk insert
            await transaction.request().bulk(table);
            await transaction.commit();
            
            logDebug(context, 'Successfully processed households data');
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        logError(context, err);
        throw err;
    }
}

async function processTransactions(data) {
    const context = 'processTransactions';
    try {
        logDebug(context, 'Processing transactions data', { rowCount: data.length });
        
        await ensureConnection();

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await transaction.request().query('DELETE FROM Transactions');

            const table = new sql.Table('Transactions');
            
            Object.entries(TABLE_SCHEMAS.Transactions).forEach(([column, type]) => {
                table.columns.add(column, type, { nullable: true });
            });

            data.forEach(row => {
                table.rows.add(
                    parseInt(row.HSHD_NUM) || null,
                    row.BASKET_NUM || null,
                    row.PURCHASE ? new Date(row.PURCHASE) : null,
                    parseInt(row.PRODUCT_NUM) || null,
                    parseFloat(row.SPEND) || null,
                    parseInt(row.UNITS) || null,
                    row.STORE_R || null,
                    parseInt(row.WEEK_NUM) || null,
                    parseInt(row.YEAR) || null
                );
            });

            await transaction.request().bulk(table);
            await transaction.commit();
            
            logDebug(context, 'Successfully processed transactions data');
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        logError(context, err);
        throw err;
    }
}

async function processProducts(data) {
    const context = 'processProducts';
    try {
        logDebug(context, 'Processing products data', { rowCount: data.length });
        
        await ensureConnection();

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await transaction.request().query('DELETE FROM Products');

            const table = new sql.Table('Products');
            
            Object.entries(TABLE_SCHEMAS.Products).forEach(([column, type]) => {
                table.columns.add(column, type, { nullable: true });
            });

            data.forEach(row => {
                table.rows.add(
                    parseInt(row.PRODUCT_NUM) || null,
                    row.DEPARTMENT || null,
                    row.COMMODITY || null,
                    row.BRAND_TY || null,
                    row.NATURAL_ORGANIC_FLAG || null
                );
            });

            await transaction.request().bulk(table);
            await transaction.commit();
            
            logDebug(context, 'Successfully processed products data');
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        logError(context, err);
        throw err;
    }
}

async function getDashboardData() {
    const context = 'getDashboardData';
    try {
        await ensureConnection();
        
        logDebug(context, 'Starting dashboard data fetch');
        
        // Get key statistics
        const statsQuery = `
            SELECT 
                COUNT(DISTINCT h.HSHD_NUM) as totalHouseholds,
                COUNT(DISTINCT t.BASKET_NUM) as totalTransactions,
                AVG(t.SPEND) as averageSpend,
                CAST(SUM(CASE WHEN h.L = 'Y' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) as loyaltyRate
            FROM Households h
            LEFT JOIN Transactions t ON h.HSHD_NUM = t.HSHD_NUM`;
        
        const stats = await pool.request().query(statsQuery);
        logDebug(context, 'Stats query completed');

        // Get household size distribution
        const householdSizeQuery = `
            SELECT HH_SIZE as label, COUNT(*) as value
            FROM Households
            WHERE HH_SIZE IS NOT NULL
            GROUP BY HH_SIZE
            ORDER BY 
                CASE 
                    WHEN ISNUMERIC(HH_SIZE) = 1 THEN CAST(HH_SIZE AS INT)
                    ELSE 999
                END`;
        
        const householdSizes = await pool.request().query(householdSizeQuery);
        logDebug(context, 'Household sizes query completed');

        // Get income range distribution
        const incomeQuery = `
            SELECT INCOME_RANGE as label, COUNT(*) as value
            FROM Households
            WHERE INCOME_RANGE IS NOT NULL
            GROUP BY INCOME_RANGE
            ORDER BY 
                CASE INCOME_RANGE
                    WHEN 'Under 35K' THEN 1
                    WHEN '35-49K' THEN 2
                    WHEN '50-74K' THEN 3
                    WHEN '75-99K' THEN 4
                    WHEN '100-150K' THEN 5
                    WHEN '150K+' THEN 6
                    ELSE 7
                END`;
        
        const incomeRanges = await pool.request().query(incomeQuery);

        // Get department spending
        const departmentQuery = `
            SELECT 
                p.DEPARTMENT as label,
                AVG(t.SPEND) as value
            FROM Transactions t
            JOIN Products p ON t.PRODUCT_NUM = p.PRODUCT_NUM
            WHERE p.DEPARTMENT IS NOT NULL
            GROUP BY p.DEPARTMENT
            ORDER BY value DESC`;
        
        const departmentSpend = await pool.request().query(departmentQuery);

        // Get monthly spending trends
        const monthlyQuery = `
            SELECT 
                CONCAT(YEAR, '-', RIGHT('0' + CAST(MONTH AS VARCHAR(2)), 2)) as label,
                AVG(SPEND) as value
            FROM (
                SELECT 
                    YEAR,
                    MONTH(PURCHASE) as MONTH,
                    SPEND
                FROM Transactions
            ) m
            GROUP BY YEAR, MONTH
            ORDER BY YEAR, MONTH`;
        
        const monthlySpend = await pool.request().query(monthlyQuery);

        // Get age range distribution
        const ageQuery = `
            SELECT AGE_RANGE as label, COUNT(*) as value
            FROM Households
            WHERE AGE_RANGE IS NOT NULL
            GROUP BY AGE_RANGE
            ORDER BY 
                CASE AGE_RANGE
                    WHEN '19-24' THEN 1
                    WHEN '25-34' THEN 2
                    WHEN '35-44' THEN 3
                    WHEN '45-54' THEN 4
                    WHEN '55-64' THEN 5
                    WHEN '65+' THEN 6
                    ELSE 7
                END`;
        
        const ageRanges = await pool.request().query(ageQuery);

        // Get marital status distribution
        const maritalQuery = `
            SELECT MARITAL as label, COUNT(*) as value
            FROM Households
            WHERE MARITAL IS NOT NULL
            GROUP BY MARITAL`;
        
        const maritalStatus = await pool.request().query(maritalQuery);

        // Get regional spending
        const regionQuery = `
            SELECT 
                STORE_R as label,
                AVG(SPEND) as value
            FROM Transactions
            WHERE STORE_R IS NOT NULL
            GROUP BY STORE_R
            ORDER BY value DESC`;
        
        const regionSpend = await pool.request().query(regionQuery);

        // Format and return the response
        const response = {
            totalHouseholds: stats.recordset[0].totalHouseholds,
            totalTransactions: stats.recordset[0].totalTransactions,
            averageSpend: stats.recordset[0].averageSpend,
            loyaltyRate: stats.recordset[0].loyaltyRate,
            householdSizes: {
                labels: householdSizes.recordset.map(r => r.label),
                values: householdSizes.recordset.map(r => r.value)
            },
            incomeRanges: {
                labels: incomeRanges.recordset.map(r => r.label),
                values: incomeRanges.recordset.map(r => r.value)
            },
            departmentSpend: {
                labels: departmentSpend.recordset.map(r => r.label),
                values: departmentSpend.recordset.map(r => r.value)
            },
            monthlySpend: {
                labels: monthlySpend.recordset.map(r => r.label),
                values: monthlySpend.recordset.map(r => r.value)
            },
            ageRanges: {
                labels: ageRanges.recordset.map(r => r.label),
                values: ageRanges.recordset.map(r => r.value)
            },
            maritalStatus: {
                labels: maritalStatus.recordset.map(r => r.label),
                values: maritalStatus.recordset.map(r => r.value)
            },
            regionSpend: {
                labels: regionSpend.recordset.map(r => r.label),
                values: regionSpend.recordset.map(r => r.value)
            }
        };

        logDebug(context, 'Dashboard data fetch completed successfully');
        return response;
    } catch (err) {
        logError(context, err);
        throw new Error(`Failed to fetch dashboard data: ${err.message}`);
    }
}

// Graceful shutdown function with enhanced logging
async function closePool() {
    try {
        if (connectionCheckInterval) {
            clearInterval(connectionCheckInterval);
        }
        logDebug('closePool', 'Attempting to close database pool');
        if (pool) {
            await pool.close();
        }
        poolReady = false;
        logDebug('closePool', 'Pool closed successfully');
    } catch (err) {
        logError('closePool', err);
        throw err;
    }
}

// Handle process termination
process.on('SIGTERM', async () => {
    try {
        await closePool();
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
});

// Add these functions to expose pool status
function isPoolReady() {
    return poolReady && pool !== null;
}

function getPool() {
    return pool;
}

// Add this after the ensureConnection initialization
connectionCheckInterval = setInterval(async () => {
    try {
        if (poolReady && pool) {
            await pool.request().query('SELECT 1');
        } else {
            await ensureConnection();
        }
    } catch (err) {
        logError('Connection Check', 'Periodic connection check failed, will reconnect');
        poolReady = false;
        await ensureConnection().catch(err => {
            logError('Periodic Reconnection', err);
        });
    }
}, IDLE_CHECK_INTERVAL);

module.exports = { 
    searchHousehold,
    closePool,
    processHouseholds,
    processTransactions,
    processProducts,
    getDashboardData,
    isPoolReady,
    getPool,
    ensureConnection
};
