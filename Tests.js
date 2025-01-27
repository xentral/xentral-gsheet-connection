function testResortResponseData() {
    let mockData = {
      "header":["sales_order_id", "net_revenue"],
      "rows":[["12","32.15"], ["1", "3.48"], ["2", "18.50"]]
      };
  
    let correct_result = [["sales_order_id", "net_revenue"], ["12","32.15"], ["1", "3.48"], ["2", "18.50"]];
    result = resortResponseData(mockData);
    Logger.log(result)
    if (String(result) == String(correct_result)) {
      Logger.log("testResortResponseData passed!");
    }
    else {
      Logger.log("testResortResponseData failed!");
    }
  }
  