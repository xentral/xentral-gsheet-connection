const XENTRAL_URL = 'https://YOUR_INSTANCE.xentral.biz' // Your Xentral Instance
const PAT = '' // Your Personal Access Token in between ''
const ENDPOINT = '/api/analytics/query' // Query Endpoint
let TEST_SQL_STATEMENT = `
    SELECT
      sales_order_id,
      net_revenue
    FROM sales_orders
    LIMIT 5;
`; // Only for testing

/**
* Imports JSON data to your spreadsheet Ex: QUERY_XENTRAL("SQL statement")
* @param sqlStr SQL statement that you want to execute
* @customfunction
* @returns {Array} - The array inserted into the sheet
*/

function QUERY_XENTRAL(sqlStr=TEST_SQL_STATEMENT){
  Logger.log("Invoked with SQL statement: %s", sqlStr)
  let payload = JSON.stringify({ query: sqlStr });
  Logger.log("Paylod: %s", payload)
  const concatenatedEndpoint = XENTRAL_URL + ENDPOINT
  try{
    const options = {
      method: 'POST',
      payload: payload,
      headers: {
        accept: 'application/vnd.xentral.default.v1+json',
        'content-type': 'application/vnd.xentral.default.v1+json',
        authorization: 'Bearer ' + PAT
      }
    };
    let res = UrlFetchApp.fetch(concatenatedEndpoint, options)
    let content = res.getContentText();
    let jsonResult = JSON.parse(content);
    let data = jsonResult["data"];

    Logger.log(jsonResult);
    Logger.log(data);

    return resortResponseData(data)
  }
  catch(err){
      Logger.log(err);
      return ("Error: " + JSON.stringify(err));  
  }
}

/**
 * Transforms API response into a array
 * @param {Object[]} data - The API response data
 * @returns {Array} - The array inserted into the sheet
 */

function resortResponseData(data) {
  return [data.header, ...data.rows];
}