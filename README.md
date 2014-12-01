TrafficCounter
==============

This express library is meant to count raw traffic (requests) on arbitrary express route handlers.

It is not meant to differentiate the values of query strings or parameters, but rather the expression specified in handlers.

As such, it is best used to determine traffic in core areas of your web page.

It's sole dependency is the node.js mongodb driver and a running database.

Status
======

Unit tests are almost complete. Will need to add facility and tests to handle the database not being responsive gracefully (ie, not wait forever).

Also planning on adding an option to track urls, not just path expressions.

Installation
============

npm install traffic-counter

Running Tests
=============

In the directory where the module is located, run the following 2 commands on the prompt:

- npm install
- npm test

Initial Setup
=============

Assuming you required the library in a TrafficCounter variable as follows...

```javascript
var TrafficCounter = require('traffic-counter');
```

First, you need to ensure core collection dependencies by calling the following asynchronous call:

```javascript
TrafficCounter.Setup(<Database>, <Callback>);
```

The <Database> argument, which is a mongodb database connection, is mandatory.

The <Callback> argument is optional. If used, it takes the following form:

```javascript
TrafficCounter.Setup(SomeDBConnection, function(Err) {
    if(Err)
    {
        //Handle error
    }
    else
    {
        //Everything is fine, proceed...
    }

});
```

Alternatively, you can put handlers on the following 2 events instead:

```javascript
TrafficCounter.Event.SetupFinished
TrafficCounter.Event.Error
```

Taking the second route looks like this:

```javascript
TrafficCounter.on(TrafficCounter.Event.SetupFinished, function() {
    //Everything is fine, proceed
});

TrafficCounter.on(TrafficCounter.Event.Error, function(Err) {
    //Handle error
});

TrafficCounter.Setup(SomeDBConnection);
```

Handling Paths
==============

Let's say you have the following paths for which you want to track traffic:

```javascript
app.get('/', SomeFunction);
...
app.get('/Friends/:Friend', OtherFunction);
```

Assume that for the first one, you want to track the traffic per hour for the past 12 hours and for the second one, you want to track the traffic per day for the past 7 days.

You'd adjust your code as follow:

```javascript
app.get('/', TrafficCounter.CountTraffic(TrafficCounter.TimeUnit.Hour, 12, app);
app.get('/', SomeFunction);
...
app.get('/', TrafficCounter.CountTraffic(TrafficCounter.TimeUnit.Day, 7, app);
app.get('/Friends/:Friend', OtherFunction);
```

The above will track traffic for the '/' and '/Friends/:Friend' paths. In the later case, requests to the URL /Friends/Peter and /Friends/Fred will count as the same path.

If you find '/' and '/Friends/:Friend' to be a little ugly, you can specify an alias for the paths as follow:

```javascript
app.get('/', TrafficCounter.CountTraffic(TrafficCounter.TimeUnit.Hour, 12, app, 'MainPage'));
app.get('/', SomeFunction);
...
app.get('/Friends/:Friend', TrafficCounter.CountTraffic(TrafficCounter.TimeUnit.Day, 7, app, 'FriendLookup'));
app.get('/Friends/:Friend', OtherFunction);
```

More formally, TrafficCounter.CountTraffic has the following signature:

```javascript
TrafficCounter.CountTraffic(<TimeUnit>, <Length>, <App>, <PathAlias>);
```

All arguments except the last are mandatory.

- "TimeUnit" can take the following values: TrafficCounter.TimeUnit.Minute, TrafficCounter.TimeUnit.Hour, TrafficCounter.TimeUnit.Day, TrafficCounter.TimeUnit.Month
- "Length" must be a valid integer greater than 0.
- "App" must be the express app that the route handler is assigned to.
- "PathAlias" is a string representing an alternative (hopefully more user friendly) name for the path.

Quirk
=====

Due to incompleteness in the way Express preserves (or more specifically doesn't preserve) path expressions, I've been unable to find a way so far to preserve the path expression in the following 2 example cases:

```javascript
App.use('/SomePath/:SomeParam', TrafficCounter.CountTraffic(..., App));
//Requests on /SomePath/1 will be stored as /SomePath/1, not /SomePath/:SomeParam
```

```javascript
AppRouter = express.Router();
AppRouter.all('/SomePath', TrafficCounter.CountTraffic(..., AppRouter));
App.use('/SomePath/:SomeParam', AppRouter);
//Requests on /SomePath/1/SomePath will be stored as /SomePath/1/SomePath, not /SomePath/:SomeParam/SomePath
```

A workaround for this is to explicitly specify the path in the last parameter of TrafficCounter.CountTraffic:

```javascript
App.use('/SomePath/:SomeParam', TrafficCounter.CountTraffic(..., App, '/SomePath/:SomeParam'));
//Now, requests on /SomePath/1 will be stored as /SomePath/:SomeParam
```

Handling Errors When Counting
=============================

TrafficCounter.CountTraffic will make the following call when encountering an error:

```javascript
next(<Error>)
```

As a result, it's important to put some error handling (handler with the (err, req, res, next) signature) in order to better control what the end user will see in his browser.

Additionally, the following event will be emited and can be caught:

```javascript
TrafficCounter.Event.RequestError
```

Accessors to view the Data
==========================

There are 2 accessors to access the data. Both trigger the TrafficCounter.Event.ReportError event if a problem occurs:

1) ```GetPaths(<Callback>)```

Gets a list of paths monitored by the library so far.

<Callback> takes the following form:

```javascript
function(<Err>, <Paths>)
```

"Err" is an error if any occured (else its a falsy value) and "Paths" is an array containing the paths the library tracked so far as strings.

2) ```GetTraffic(<Params>, <Callback>)```

Gets either scalar or vectorial (array containing several tracked time intervals) information concerning the traffic for a given path.

This function takes a reference Date (defaults to the exact time when the function is called), computes a prior Date that is a given number of 
units of time before the reference Date and either sum all the traffic between those Dates (inclusive) or return the traffic for all recorded 
time intervals between those Dates.

"Params" is an object containing the following keys:

- ReferenceTime (optional): Defaults to the current time if not specified. It is a Date object.
- Length: Determines how many units of time to substract from ReferenceTime to compute the prior Date. In addition, the prior Date will be
          truncated down to the time unit of interest (ex: if it is hours, the minutes will be truncated to 0) after the substraction.
- TimeUnit: Determines the unit of time (TrafficCounter.TimeUnit) that is used to substract from ReferenceTime as well as truncated the result.
- Path: The path that is analysed.
- Cumulative (optional): If set to true, a sum of all traffic between ReferenceTime (inclusive) and the prior Date (inclusive) is returned in the callback. 
                         Otherwise, an array of all recorded time intervals (and their traffic) between ReferenceTime and prior Date (again, both inclusive)
                         is returned in the callback.

<Callback> takes the following form:

```javascript
function(<Err>, <Result>)
```

"Err" is an error if any occured (else its a falsy value). 

"Result" takes the following form:
- If Cumulative is set to true, it is a natural number.
- If Cumulative is set to false or not specified, it is an array taking the following form:
  ```[<TimeInterval1>, <TimeInterval2>, ..., <TimeIntervalN>]```, where "TimeInterval..." takes the following form in turn:
  ```{'Views': <NumberOfViews>, 'Date': <TruncatedDateRepresentingInterval>}```

Utility Method
==============

The following method is used internally to operate on and truncate time:

```TruncateTime(<TimeUnitParam>, <Time>, <Modifier>)```

It is made available externally (ie, TrafficCounter.TrancateTime(...)) in case someone needs it to manipulate the "ReferenceTime" parameter for the
"GetTraffic" method.

Assuming that you could do straightfoward arithmetic on Date objects, the operation it does would look like this:

```Return = floor(<Time>+<Modifier>*<TimeUnitParam>, <TimeUnitParam>)```

Ex:

```
var Now = new Date();
console.log(Now);        //logs "Mon Dec 01 2014 06:01:11 GMT-0500 (EST)"
var Result = TrafficCounter.TruncateTime(TrafficCounter.TimeUnit.Hour, Now, 2);
console.log(Result);     //logs "Mon Dec 01 2014 08:00:00 GMT-0500 (EST)"
```


