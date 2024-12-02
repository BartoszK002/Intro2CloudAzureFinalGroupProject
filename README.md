# Retail Analysis Web Application

A web-based application for analyzing retail transaction data, built with vanilla JavaScript and Azure SQL Database. The application provides comprehensive retail analytics through an interactive dashboard and detailed household data search functionality.

## Features

- **Interactive Dashboard**
  - Key performance metrics
  - Demographic analysis
  - Spending patterns visualization
  - Regional distribution insights
  - Customer segmentation charts

- **Household Data Search**
  - Detailed transaction history
  - Advanced sorting capabilities
  - CSV export functionality
  - Real-time data filtering

- **Data Management**
  - Data upload interface
  - File validation
  - Batch processing support

## Project Structure

```
site/wwwroot/
├── public/
│   ├── dashboard.html     # Analytics dashboard
│   ├── data.html         # Household search interface
│   ├── upload.html       # Data upload page
│   └── styles/
│       ├── common.css    # Shared styles
│       ├── dashboard.css # Dashboard-specific styles
│       ├── data.css     # Data page styles
│       └── upload.css   # Upload page styles
├── server.js             # Main server file
├── api.js               # Database API functions
├── package.json         # Project dependencies
└── web.config           # IIS configuration for Azure
```

## File Descriptions

### dashboard.html
Main analytics dashboard featuring:
- Key business metrics (total households, transactions, revenue)
- Interactive charts using Chart.js
- Demographic analysis
- Spending pattern analysis
- Regional distribution insights

### data.html
Household data search interface with:
- Real-time search functionality
- Advanced sorting and filtering
- Tabular data display
- CSV export capability
- Data caching for performance

### upload.html
Data upload interface providing:
- File upload functionality
- Data validation
- Progress tracking
- Success/error feedback

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
- Caching mechanisms

## Setup Requirements

- Node.js 18.x or higher
- Azure Web App Service
- Azure SQL Database
- Modern web browser with JavaScript enabled

## Environment Variables

```
DB_USER=finalprojfs24
DB_SERVER=retail-server-finalproj.database.windows.net
DB_DATABASE=RetailDB
```

## Database Schema

The application uses three main tables:
- **Households**: Customer demographic data
  - Household number
  - Age range
  - Marital status
  - Income range
  - Homeowner status
  - Household composition
  - Household size
  - Children

- **Transactions**: Purchase transaction records
  - Transaction date
  - Product number
  - Spend amount
  - Units purchased
  - Store region
  - Week number
  - Year
  - Loyalty flag

- **Products**: Product information
  - Product number
  - Department
  - Commodity
  - Brand type
  - Natural/organic flag

## Features in Detail

### Dashboard Analytics
- Total households and transactions
- Average spend and loyalty rate
- Transactions per household
- Total revenue
- Most active department
- Peak shopping month
- Demographic distributions
- Spending patterns
- Regional analysis

### Household Search
- Real-time search by household number
- Sortable columns
- Data export to CSV
- Cached search results
- Formatted data display
- Null value handling

### Data Upload
- File type validation
- Progress tracking
- Error handling
- Success confirmation

## Technologies Used

- **Frontend**:
  - Vanilla JavaScript
  - Chart.js for visualizations
  - HTML5/CSS3
  - Responsive design

- **Backend**:
  - Node.js
  - Azure SQL Database
  - REST API endpoints

## Browser Compatibility

The application is optimized for modern web browsers including:
- Google Chrome (latest)
- Mozilla Firefox (latest)
- Microsoft Edge (latest)
- Safari (latest)