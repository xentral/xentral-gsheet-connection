// This is a template file. Replace {your_instance} with your actual Xentral
// instance URL and set the PAT. The following code does not need to be modified.
const XENTRAL_URL = 'https://{your_instance}.xentral.biz' // Your Xentral Instance
const PAT = '' // Your Personal Access Token in between ''

// ========================================
// DO NOT EDIT CODE BELOW THIS LINE
// ========================================

const MAX_RETRIES = 30 //maximum number of retries
const DELAY_MS = 2000 //delay between retries in milliseconds
const CREATE_QUERY_EXPORT_ENDPOINT = "/api/v1/analytics/query/export" //returns uuid
const GET_QUERY_EXPORT_ENDPOINT = "/api/v1/analytics/query/export/" //+{uuid} //call this until status = success or failed
const CREATE_EXPORT_ENDPOINT = "/api/v1/analytics/report/" //{id}/export
const GET_EXPORT_ENDPOINT = "/api/v1/analytics/report/" // {id}/export/{uuid}
const TEST_SQL_STATEMENT = `
    SELECT
      sales_order_id,
      net_revenue
    FROM sales_orders
    INNER JOIN sales_order_items USING(sales_order_id)
    LIMIT 5;
` // Only for testing

/**
 * Imports CSV data to your spreadsheet Ex: XENTRAL_QUERY ("SQL statement")
 * @param sqlStr SQL statement that you want to execute
 * @customfunction
 * @returns {Array} - The array inserted into the sheet
 */
function XENTRAL_QUERY(sqlStr = TEST_SQL_STATEMENT) {
    try {
        if (!sqlStr) {
            throw new Error("SQL statement is required")
        }

        Logger.log("Executing SQL: %s", sqlStr)

        const payload = JSON.stringify({
            query: sqlStr,
            settings: {
                exportFormat: "csv",
                delimiter: ","
            }
        })
        const queryEndpoint = XENTRAL_URL + CREATE_QUERY_EXPORT_ENDPOINT

        const options = {
            method: "POST",
            payload: payload,
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                authorization: "Bearer " + PAT
            }
        }

        const res = UrlFetchApp.fetch(queryEndpoint, options)
        const json = JSON.parse(res.getContentText())
        const uuid = json["data"][0]["id"]

        Logger.log("Query export UUID: %s", uuid)

        const downloadUrl = pollForExportUrl(uuid, GET_QUERY_EXPORT_ENDPOINT)
        const result = downloadCSV(downloadUrl)

        return result
    } catch (err) {
        Logger.log("XENTRAL_QUERY error: %s", err.message)
        return [["Error"], [err.message]]
    }
}

/**
 * Imports CSV data to your spreadsheet Ex: XENTRAL_REPORT ("REPORT ID")
 * @param reportId ID of the report you want to execute
 * @customfunction
 * @returns {Array} - The array inserted into the sheet
 */
function XENTRAL_REPORT(reportId) {
    try {
        if (!reportId) {
            throw new Error("Report ID is required")
        }

        Logger.log("Fetching report ID: %s", reportId)

        const queryEndpoint =
            XENTRAL_URL + CREATE_EXPORT_ENDPOINT + reportId + "/export"
        const exportEndpoint = GET_EXPORT_ENDPOINT + reportId + "/export/"
        const uuid = createExportTask(queryEndpoint)

        const downloadUrl = pollForExportUrl(uuid, exportEndpoint)
        return downloadCSV(downloadUrl)
    } catch (err) {
        Logger.log("XENTRAL_REPORT error: %s", err.message)
        return [["Error"], [err.message]]
    }
}

/**
 * Makes a POST request to Xentral to create an export task
 */
function createExportTask(endpoint) {
    const options = {
        method: "POST",
        headers: {
            accept: "application/json",
            "content-type": "application/json",
            authorization: "Bearer " + PAT
        }
    }

    const response = UrlFetchApp.fetch(endpoint, options)
    const json = JSON.parse(response.getContentText())
    const uuid = json["data"][0]["id"]
    Logger.log("Export task UUID: %s", uuid)
    return uuid
}

/**
 * Polls the export task until it's ready and returns the download URL
 */
function pollForExportUrl(uuid, endpoint) {
    const exportEndpoint = XENTRAL_URL + endpoint + uuid
    Logger.log(exportEndpoint)

    const options = {
        method: "GET",
        headers: {
            accept: "application/json",
            "content-type": "application/json",
            Authorization: "Bearer " + PAT
        }
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        Utilities.sleep(DELAY_MS)
        const res = UrlFetchApp.fetch(exportEndpoint, options)
        const data = JSON.parse(res.getContentText())["data"][0]

        Logger.log("Poll #%s - Status: %s", attempt + 1, data["status"])

        if (data["status"] === "success" && data["url"]) {
            return data["url"]
        }

        if (data["status"] === "failed") {
            throw new Error("Xentral export failed. No file will be generated.")
        }
    }

    throw new Error("Export not ready after polling.")
}

/**
 * Downloads and parses the CSV file from S3
 */
function downloadCSV(url) {
    try {
        const response = UrlFetchApp.fetch(url)
        const csvContent = response.getContentText()
        const rows = Utilities.parseCsv(csvContent)

        Logger.log("CSV Rows: %s", rows.length)
        if (rows.length === 0) return []

        const headers = rows[0]
        const dataRows = rows.slice(1)

        // Detect numeric columns (all values must be numeric or empty)
        const numCols = headers.length
        const numericColumnFlags = Array(numCols).fill(true)

        for (let i = 0; i < numCols; i++) {
            for (let row of dataRows) {
                const cell = row[i]?.trim() ?? ""
                if (cell === "") continue // allow empty
                if (isNaN(cell)) {
                    numericColumnFlags[i] = false
                    break // no need to check remaining rows for this column
                }
            }
        }

        // Transform values only in numeric columns
        const cleanedRows = dataRows.map((row) =>
            row.map((cell, i) => {
                const value = cell?.trim() ?? ""
                if (numericColumnFlags[i] && value !== "") {
                    const num = parseFloat(value)
                    return isNaN(num) ? value : num
                }
                return value
            })
        )

        return [headers, ...cleanedRows]
    } catch (e) {
        Logger.log("Error downloading CSV: %s", e.message)
        throw e
    }
}