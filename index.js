var crypto = require('crypto');
var events = require('./eventEmitter.js');
var http = require('http');
var accountId = '589daf4c09c34aafa9e92e32';

var lastOrderBook;

var options = {
  //host: 'localhost',
  host: '40.114.240.33',
  port: 3033
};

function getOrderBook(cb){
  var localOptions = Object.assign({}, options);
  localOptions.path = '/getBidsAndAsks';
  http.request(localOptions, function(response){
    var str = '';

    response.on('data', function (chunk) {
      str += chunk;
    });

    response.on('end', function () {
      var obj = JSON.parse(str);
      cb(obj);  
    });
  }).end();
}

function cancelOrder(order, cb){
  var localOptions = Object.assign({}, options);
  localOptions.path = '/cancelOrder';
  localOptions.method = 'POST';
  localOptions.headers = {'Content-Type': 'application/json'};
  
  var req = http.request(localOptions, function(response){
    var str = ''
    response.on('data', function (chunk) {
      str += chunk;
    });

    response.on('end', function () {
      var obj = JSON.parse(str);
      cb(obj);  
    });
  });

  req.write(JSON.stringify(order));
  req.end();
}

function submitOrder(order, cb){
  var localOptions = Object.assign({}, options);
  localOptions.path = '/submitOrder';
  localOptions.method = 'POST';
  localOptions.headers = {'Content-Type': 'application/json'};
  
  var req = http.request(localOptions, function(response){
    var str = ''
    response.on('data', function (chunk) {
      str += chunk;
    });

    response.on('end', function () {
      var obj = JSON.parse(str);
      cb(obj);  
    });
  });

  req.write(order);
  req.end();
}

var priceIncrement = 0.01;
var amount = 0.01;

function placeInnerMostAsk(asks, cb){
  var price = Number(asks[0].price) - priceIncrement;
  var order = {
    timestamp: new Date().getTime(),
    accountId: accountId,
    type: 'ask',
    price: price,
    amount: amount,
  };
  var strOrder = JSON.stringify(order);
  submitOrder(strOrder, function(res){
    cb(res);
  });
}

function placeInnerMostBid(bids, cb){
  var price = Number(bids[0].price) + priceIncrement;
  var order = {
    timestamp: new Date().getTime(),
    accountId: accountId,
    type: 'bid',
    price: price,
    amount: amount,
  };
  var strOrder = JSON.stringify(order);
  submitOrder(strOrder, function(res){
    cb(res);
  });
}

function isInnerMostBidMine(bids){
  if(bids[0] && bids[0].accountId == accountId){
    return true;
  } else {
    return false;
  }
}

function isInnerMostAskMine(asks){
  if(asks[0] && asks[0].accountId == accountId){
    return true;
  } else {
    return false;
  }
}

events.on('orderBookChange', function(orderBook){
   if(orderBook.bids.length > 0 && orderBook.asks.length > 0){
    var innerMostAskPrice = Number(orderBook.asks[0].price);
    var innerMostBidPrice = Number(orderBook.bids[0].price);
    var spread = innerMostAskPrice - innerMostBidPrice;

    console.log('spread:', spread);
    console.log('Bids', innerMostBidPrice - Number(orderBook.bids[1].price));
    console.log('Asks', Number(orderBook.asks[1].price) - innerMostAskPrice);

    if(spread > 0.01){
      if(!isInnerMostBidMine(orderBook.bids)){
        placeInnerMostBid(orderBook.bids, function(result){
          console.log('Placed inner most bid:', result);
        }); 
      } else if(orderBook.bids.length > 0 
          && innerMostBidPrice - Number(orderBook.bids[1].price) > priceIncrement*2) {
        cancelOrder(orderBook.bids[0], function(result){
          console.log('Cancelled order:', result);
        });   
      }
      if(!isInnerMostAskMine(orderBook.asks)){
        placeInnerMostAsk(orderBook.asks, function(result){
          console.log('Placed inner most ask:', result);
        }); 
      } else if(orderBook.asks.length > 0 
          && Number(orderBook.asks[1].price) - innerMostAskPrice > priceIncrement*2) {
        cancelOrder(orderBook.asks[0], function(result){
          console.log('Cancelled order:', result);
        });   
      }
    }
  }
});

function main(){
  var startTime = new Date().getTime();
  getOrderBook(function(orderBook){
    var responseTime = new Date().getTime() - startTime;
    var stringOrderBook = JSON.stringify(orderBook);
    var shasum = crypto.createHash('sha1');
    shasum.update(stringOrderBook);
    var digest = shasum.digest('hex');
    if(digest != lastOrderBook){
      console.log('Time:', new Date());
      console.log('responseTime:', responseTime+'ms');
      lastOrderBook = digest;
      events.emit('orderBookChange', orderBook);
    }
  });
}

function run(){
  setInterval(function(){
    main();
  }, 5000);
}

run();
