/*
Copyright (c) 2014 Eric Vallee <eric_vallee2003@yahoo.ca>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var http = require('http');
var express = require('express');
var path = require('path');
var MongoDB = require('mongodb');
var TrafficCounter = require('TrafficCounter');

TrafficCounter.on(TrafficCounter.Event.Error, function(Err) {
    //This is an error that occured during the initial object creation
    //Probably ok to exit here
    console.log(Err);
});

TrafficCounter.on(TrafficCounter.Event.RequestError, function(Err) {
    //This is an error that occured once the web server is up and running
    //Probably advisable to recover gracefull from this one
    console.log(Err);
});

TrafficCounter.on(TrafficCounter.Event.SetupFinished, function() {
    //We are now ready to use the traffic counter in app.VERB
    //Putting the app.VERB logic here is a viable alternative to
    //using a callback
    console.log('Setup of the TrafficCounter object complete!');
});

var app = express();

MongoDB.MongoClient.connect("mongodb://localhost:27017/test", {native_parser:true}, function(Err, DB) {
    TrafficCounter.Setup(DB, function() {
        //This will keep track of requests count per hour increment for up to 30 hours in the past
        app.all('/', TrafficCounter.CountTraffic(TrafficCounter.TimeUnit.Hour, 30, app));
        app.get('/', function(Req, Res){
            Res.send('Imagine a pretty home page.');
        });
        
        //This will keep track of requests count per day increment for up to 7 days in the past
        app.all('/UpdateYourBrowser', TrafficCounter.CountTraffic(TrafficCounter.TimeUnit.Day, 7, app));
        app.get('/UpdateYourBrowser', function(Req, Res){
            Res.send('Every web developper wants to send this one to those using IE 8 and below!');
        });
        
        //This will keep track of requests count per month increment for up to 12 months in the past
        //All requests will be counted under '/SomeParam/:MyParam' so '/SomeParam/Yes' and ''/SomeParam/No'
        //are the same for the purpose of counting requests.
        app.all('/SomeParam/:MyParam', TrafficCounter.CountTraffic(TrafficCounter.TimeUnit.Month, 12, app));
        app.get('/SomeParam/:MyParam', function(Req, Res){
            Res.send('We do not really care about the parameter in this example.');
        });
        
        http.createServer(app).listen(8080);
    });
});
