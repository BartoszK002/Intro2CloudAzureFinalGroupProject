# Retail Analysis Web Application

A web-based application for analyzing retail transaction data, built with Node.js and Azure SQL Database.

## Project Structure

```
site/wwwroot/
├── public/
│   ├── index.html      # Login page
│   └── data.html       # Data visualization page
├── server.js           # Main server file
├── api.js             # Database API functions
├── package.json       # Project dependencies
└── web.config         # IIS configuration for Azure
```

## File Descriptions

### server.js
Main application server that:
- Handles routing
- Serves static files
- Manages database connections
- Processes API requests

### api.js
Contains database interaction logic:
- SQL query definitions
- Database connection configuration
- Data transformation functions

### public/index.html
Login page that includes:
- User authentication form
- Basic validation
- Redirect to data page

### public/data.html
Main data visualization page featuring:
- Household data search
- Tabular data display
- CSV export functionality

### package.json
Project configuration including:
- Dependencies
- Scripts
- Node.js version requirements

### web.config
IIS configuration for Azure Web App:
- URL rewriting rules
- Node.js handlers
- Security settings

## Setup Requirements

- Node.js 18.x or higher
- Azure Web App Service
- Azure SQL Database

## Environment Variables

```
DB_USER=finalprojfs24
DB_SERVER=retail-server-finalproj.database.windows.net
DB_DATABASE=RetailDB
```

## Database Schema

The application uses three main tables:
- Households: Customer demographic data
- Transactions: Purchase transaction records
- Products: Product information and categories
