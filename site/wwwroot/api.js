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

// Create a connection pool
const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect().catch(err => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
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

async function searchHousehold(hshdNum) {
    const context = `searchHousehold(${hshdNum})`;
    try {
        logDebug(context, 'Starting household search', { hshdNum });
        
        // Ensure pool is connected
        await poolConnect;
        logDebug(context, 'Database pool connected successfully');

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
        throw new Error(`Failed to fetch household data: ${err.message}`);
    }
}

async function processHouseholds(data) {
    const context = 'processHouseholds';
    try {
        logDebug(context, 'Processing households data', { rowCount: data.length });
        await poolConnect;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Clear existing data
            await transaction.request().query('DELETE FROM Households');

            // Insert new data
            for (const row of data) {
                await transaction.request()
                    .input('HSHD_NUM', sql.Int, parseInt(row.HSHD_NUM))
                    .input('L', sql.Char(1), row.L)
                    .input('AGE_RANGE', sql.VarChar(100), row.AGE_RANGE)
                    .input('MARITAL', sql.VarChar(100), row.MARITAL)
                    .input('INCOME_RANGE', sql.VarChar(100), row.INCOME_RANGE)
                    .input('HOMEOWNER', sql.VarChar(100), row.HOMEOWNER)
                    .input('HSHD_COMPOSITION', sql.VarChar(100), row.HSHD_COMPOSITION)
                    .input('HH_SIZE', sql.VarChar(100), row.HH_SIZE)
                    .input('CHILDREN', sql.VarChar(100), row.CHILDREN)
                    .query(`
                        INSERT INTO Households 
                        (HSHD_NUM, L, AGE_RANGE, MARITAL, INCOME_RANGE, HOMEOWNER, HSHD_COMPOSITION, HH_SIZE, CHILDREN)
                        VALUES 
                        (@HSHD_NUM, @L, @AGE_RANGE, @MARITAL, @INCOME_RANGE, @HOMEOWNER, @HSHD_COMPOSITION, @HH_SIZE, @CHILDREN)
                    `);
            }

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
        await poolConnect;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Clear existing data
            await transaction.request().query('DELETE FROM Transactions');

            // Insert new data
            for (const row of data) {
                await transaction.request()
                    .input('HSHD_NUM', sql.Int, parseInt(row.HSHD_NUM))
                    .input('BASKET_NUM', sql.VarChar(100), row.BASKET_NUM)
                    .input('PURCHASE', sql.Date, new Date(row.PURCHASE))
                    .input('PRODUCT_NUM', sql.Int, parseInt(row.PRODUCT_NUM))
                    .input('SPEND', sql.Decimal(10, 2), parseFloat(row.SPEND))
                    .input('UNITS', sql.Int, parseInt(row.UNITS))
                    .input('STORE_R', sql.VarChar(100), row.STORE_R)
                    .input('WEEK_NUM', sql.Int, parseInt(row.WEEK_NUM))
                    .input('YEAR', sql.Int, parseInt(row.YEAR))
                    .query(`
                        INSERT INTO Transactions 
                        (HSHD_NUM, BASKET_NUM, PURCHASE, PRODUCT_NUM, SPEND, UNITS, STORE_R, WEEK_NUM, YEAR)
                        VALUES 
                        (@HSHD_NUM, @BASKET_NUM, @PURCHASE, @PRODUCT_NUM, @SPEND, @UNITS, @STORE_R, @WEEK_NUM, @YEAR)
                    `);
            }

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
        await poolConnect;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Clear existing data
            await transaction.request().query('DELETE FROM Products');

            // Insert new data
            for (const row of data) {
                await transaction.request()
                    .input('PRODUCT_NUM', sql.Int, parseInt(row.PRODUCT_NUM))
                    .input('DEPARTMENT', sql.VarChar(100), row.DEPARTMENT)
                    .input('COMMODITY', sql.VarChar(100), row.COMMODITY)
                    .input('BRAND_TY', sql.VarChar(100), row.BRAND_TY)
                    .input('NATURAL_ORGANIC_FLAG', sql.Char(1), row.NATURAL_ORGANIC_FLAG)
                    .query(`
                        INSERT INTO Products 
                        (PRODUCT_NUM, DEPARTMENT, COMMODITY, BRAND_TY, NATURAL_ORGANIC_FLAG)
                        VALUES 
                        (@PRODUCT_NUM, @DEPARTMENT, @COMMODITY, @BRAND_TY, @NATURAL_ORGANIC_FLAG)
                    `);
            }

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
        await poolConnect;
        
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

        // Format the response
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

        return response;
    } catch (err) {
        logError(context, err);
        throw err;
    }
}

// Graceful shutdown function with enhanced logging
async function closePool() {
    try {
        logDebug('closePool', 'Attempting to close database pool');
        await pool.close();
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

module.exports = { 
    searchHousehold,
    closePool,
    processHouseholds,
    processTransactions,
    processProducts,
    getDashboardData
};
