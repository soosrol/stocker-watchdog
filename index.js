var firebase = require('firebase');
 
var app = firebase.initializeApp({
  serviceAccount: "sacc/stocker-8bd2be86a7ae.json",
  databaseURL: "https://stocker-56fb8.firebaseio.com"
});

var pollFrequency = 60000; //change this when not testing anymore
var counter = 0;
var quoteUrl = "http://www.google.com/finance/info?client=ig&q={SYMBOLS}";
var jsonprefix = "// ";

var latestQuotes;


var deleteAlert = function(id, userid){
  console.log("Deleting id: " + id + " - userid: " + userid);
    firebase.database().ref().child('user-alerts').child(userid).child(id).remove();
    firebase.database().ref().child('alerts').child(id).remove();  
}

var sendEmail = function(smtpTransport, alert, currentPrice, alertId){
  // Construct message
  var bodyStr = "Your stock price alert for " + alert.symbol + " has been triggered.\r\n";
  bodyStr+= "The current quote for " + alert.symbol + " is $" + currentPrice + ".\r\n";
  bodyStr+= "Alert details:\r\n";
  bodyStr+= alert.symbol + " " + alert.rule + " $" + alert.price + ", repeat " + alert.repeat; 

  //debug
  console.log("Sending email to: " + alert.email);
  console.log(bodyStr);
  
  // setup e-mail data with unicode symbols 
  var mailOptions = {
    from: "Stock alert <alert@stockalert.trade>", // sender address 
    to: alert.email, // list of receivers 
    subject: "Stock price alert for " + alert.symbol, // Subject line 
    text: bodyStr, // plaintext body 
    //html: "<b>Hello world ✔</b>" // html body 
  }
  
  // send mail with defined transport object 
  return smtpTransport.sendMail(mailOptions, function(error, response){
    if(error){
        console.log(error);
        return false;
    }else{
        console.log("Message sent: " + response.message);
        console.log("+++Repeat: " + alert.repeat);
        if(alert.repeat == "ONCE"){
          //deleteAlert
          deleteAlert(alertId, alert.uid);
        }
           
    }
});


}

var evaluateRule = function(alert, price){
  
  var currentprice = parseFloat(price);
  var alertprice = parseFloat(alert.price);


  if(alert.rule == "MORE THAN OR EQUAL"){
    return currentprice >= alertprice;    
  }
  
  if(alert.rule == "MORE THAN"){
    return currentprice > alertprice;    
  }
  
  if(alert.rule == "LESS THAN OR EQUAL"){
    return currentprice <= alertprice;    
  }
  
  if(alert.rule == "LESS THAN"){
    return currentprice < alertprice;    
  }
  
  return false;
}

var sendAlerts = function(quotes, alerts){
  console.log("send alerts===================");
  console.log(quotes);
  console.log(alerts);

  // create reusable transport method (opens pool of SMTP connections) 
  var nodemailer = require("nodemailer");
  var smtpTransport = nodemailer.createTransport('smtps://stockertrade4@gmail.com:bazmeg99@smtp.gmail.com');
  
  for (var key in alerts) {
      var a = alerts[key];
      var price = quotes[a.symbol];
                
      if(evaluateRule(a, price)){
        sendEmail(smtpTransport, a, price, key);        
      }
    }
  
  smtpTransport.close(); // shut down the connection pool, no more messages
  console.log("send alerts end===================");
}


var getQuotes = function(symbols, alerts){
  var url = quoteUrl.replace("{SYMBOLS}", symbols.join());
  console.log("quotes url: " + url);
  var request = require('request');
  request(url, function (error, response, body) {
        var quotesList = JSON.parse(response.body.replace("// ", ""));
        var latestQuotes = {};
        quotesList.forEach(function(quote){
          latestQuotes[quote.t] = quote.l;
          console.log(quote.t + " on " + quote.e + ": $" + quote.l); //debug
        });
        
        sendAlerts(latestQuotes, alerts);
  });
  
}



var watcher = function(){
	console.log(++counter + " monkey");
  var alertsRef = firebase.database().ref('/alerts');
  
  alertsRef.once('value').then(function(snapshot) {
    var alerts = snapshot.val();
    console.log(alerts);
    var symbolsToWatch = [];
    
    for (var key in alerts) {
      var a = alerts[key];          
      if(symbolsToWatch.indexOf(a.symbol) < 0){
        symbolsToWatch.push(a.symbol);
      }
    }
     
    getQuotes(symbolsToWatch, alerts);
  }).catch(function(error) {
    console.log('Watcher error: ', error);
  });
  
};



var startServer = function(){
  var express = require('express');
  var app = express();

  app.set('port', (process.env.PORT || 5000));

  //For avoidong Heroku $PORT error
  app.get('/', function (request, response) {
    var result = 'App is running'
    response.send(result);
  }).listen(app.get('port'), function () {
    console.log('App is running, server is listening on port ', app.get('port'));
  });
}



startServer();
//Start watcher		
setInterval(watcher, pollFrequency);
//watcher(); //use setinterval when not debugging anymore