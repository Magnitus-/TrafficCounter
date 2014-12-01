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

var Http = require('http');
var Express = require('express');
var MongoDB = require('mongodb');
var TrafficCounter = require('../lib/TrafficCounter');
var Nimble = require('nimble');

var Context = {};
var RandomIdentifier = 'TrafficCounterTestDB'+Math.random().toString(36).slice(-8);

/*function DefaultDBCreate(Callback)
{
    MongoDB.MongoClient.connect("mongodb://localhost:27017/"+RandomIdentifier, {native_parser:true}, function(Err, DB) {
        if(Err)
        {
            console.log(Err);
        }
        Context['DB'] = DB;
        Callback();
    });
}

function DefaultDBDestroy(Callback)
{
}*/

exports.TestHandleError = function(Test) {
    Test.expect(4);
    
    var EventCounter = 0;
    var CallbackError = null;
    var EventError = null;
    var Error;
    
    function ExpectedOkCall()
    {
        Test.ok(true, "Ok callback is called as expected.");
    }
    
    function UnexpectedOkCall()
    {
        Test.ok(false, "Ok callback was unexpectedly called.");
    }
    
    function ExpectedErrorCall(Err)
    {
        Test.ok(Err==Error, "Error callback is called as expected and is passed the right error argument.");
    }
    
    function UnexpectedErrorCall(Err)
    {
        Test.ok(false, "Error callback was unexpectedly called.");
    }
    
    function UnexpectedErrorEvent(Err)
    {
        Test.ok(false, "Error event callback was unexpectedly fired.");
    }
    
    function ExpectedErrorEvent(Err)
    {
        Test.ok(Err==Error, "Error event callback was fired as expected and got passed the correct error argument.");
    }
    
    TrafficCounter.once(TrafficCounter.Event.Test, UnexpectedErrorEvent);
    
    Error = null;
    TrafficCounter.UnitTestCalls['HandleError'].call(TrafficCounter, Error, UnexpectedErrorCall, ExpectedErrorCall, TrafficCounter.Event.Test);
    setTimeout(function() {
        Error = 1;
        TrafficCounter.UnitTestCalls['HandleError'].call(TrafficCounter, Error, ExpectedErrorCall, UnexpectedErrorCall, null);
        setTimeout(function() {
            TrafficCounter.removeListener(TrafficCounter.Event.Test, UnexpectedErrorEvent);
            TrafficCounter.once(TrafficCounter.Event.Test, ExpectedErrorEvent);
            
            Error = 2;
            TrafficCounter.UnitTestCalls['HandleError'].call(TrafficCounter, Error, ExpectedErrorCall, UnexpectedErrorCall, TrafficCounter.Event.Test);
            setTimeout(function() {
                Test.done();
            }, 100);
        }, 100);
    }, 100);
};

exports.EnsureDependencies = {
    'setUp': function(Callback) {
        MongoDB.MongoClient.connect("mongodb://localhost:27017/"+RandomIdentifier, {native_parser:true}, function(Err, DB) {
            if(Err)
            {
                console.log(Err);
            }
            Context['DB'] = DB;
            Callback();
        });
    },
    'tearDown': function(Callback) {
        Context.DB.dropDatabase(function(Err, Result) {
            if(Err)
            {
                console.log(Err);
            }
            Context.DB.close();
            Context['DB'] = null;
            TrafficCounter.UnitTestCalls.ClearMemory();
            Callback();
        });
    },
    'TestEnsureSharedDependencies': function(Test) {
        Test.expect(1);
        TrafficCounter.UnitTestCalls.EnsureSharedDependencies.call(Context, function(Err) {
            if(Err)
            {
                console.log(Err);
            }
            Context.DB.collectionNames("DefinedPaths", function(Err, Items) {
                if(Err)
                {
                    console.log(Err);
                }
                Test.ok(Items.length==1, "Ensure DefinedPaths collection is created as expected.");
                Test.done();
            });
        });
    },
    'TestEnsurePathCoreDependencies': function(Test) {
        Test.expect(2);
        TrafficCounter.UnitTestCalls.EnsureSharedDependencies.call(Context, function(Err) {
            if(Err)
            {
                console.log(Err);
            }
            TrafficCounter.UnitTestCalls.EnsurePathCoreDependencies.call(Context, {'Path': 'Test', 'Length': 10}, function(Err) {
                if(Err)
                {
                    console.log(Err);
                }
                Context.DB.collection('DefinedPaths', function(Err, DefinedPathsCollection) {
                    if(Err)
                    {
                        console.log(Err);
                    }
                    DefinedPathsCollection.find({'Path': 'Test'}).toArray(function(Err, Items) {
                        Test.ok(Items.length==1, "Ensure path was inserted in collection as expected.");
                        Context.DB.collectionNames("Test:TrafficCounter", function(Err, Items) {
                            Test.ok(Items.length==1, "Ensure collection was created as expected.");
                            Test.done();
                        });
                    });
                });
            });
        });
    },
    'TestEnsurePathDependencies': function(Test) {
        Test.expect(6);
        
        var Time = [];
        Time[0] = TrafficCounter.UnitTestCalls.TruncateNow(TrafficCounter.TimeUnit.Hour);
        var Index = 1;
        while(Index<10)
        {
            Time.push(TrafficCounter.UnitTestCalls.TruncateTime(TrafficCounter.TimeUnit.Hour, Time[0], Index));
            Index+=1;
        }
        var HourEarlier = TrafficCounter.UnitTestCalls.TruncateTime(TrafficCounter.TimeUnit.Hour, Time[0], -1);

        Nimble.series([
            function(Callback) {
                TrafficCounter.UnitTestCalls.EnsureSharedDependencies.call(Context, function(Err) {
                    Callback(Err);
                });
            },
            function(Callback) {
                TrafficCounter.UnitTestCalls.EnsurePathDependencies.call(Context, {'Path': 'Test', 'Length': 9, 'Now': Time[0]}, function(Err) {
                    Context.DB.collection('Test:TrafficCounter', function(Err, CounterCollection) {
                        CounterCollection.find({'Date': Time[0]}).toArray(function(Err, Items) {
                            Test.ok(Items.length==1, "Ensure that the counter for the specified time was inserted.");
                            if(Items.length>0)
                            {
                                Test.ok(Items[0].Views==0, "Ensure that the counter for the specified time was initialized to 0.");
                            }
                            Callback(Err);
                        });
                    });
                });
            },
            function(Callback) {
                TrafficCounter.UnitTestCalls.EnsurePathDependencies.call(Context, {'Path': 'Test', 'Length': 9, 'Now': HourEarlier}, function(Err) {
                    Context.DB.collection('Test:TrafficCounter', function(Err, CounterCollection) {
                        CounterCollection.find({'Date': HourEarlier}).toArray(function(Err, Items) {
                            Test.ok(Items.length==0, "Ensure that non-inserted counter from a previous time is not inserted.");
                            Callback(Err);
                        });
                    });
                });
            },
            function(Callback) {
                var Calls = [];
                Index = 1;
                while(Index<10)
                {
                    Calls.push((function(Callback) {
                        TrafficCounter.UnitTestCalls.EnsurePathDependencies.call(Context, {'Path': 'Test', 'Length': 9, 'Now': Time[this.Index]}, function(Err) {
                            Callback(Err);
                        });
                    }).bind({'Index': Index}));
                    Index+=1;
                }
                Nimble.series(Calls, function(Err) {
                    Context.DB.collection('Test:TrafficCounter', function(Err, CounterCollection) {
                        CounterCollection.find({'Date': Time[0]}).toArray(function(Err, Items) {
                            Test.ok(Items.length==0, "Ensure that the initial time was phased out outside the interval of interest was phased out.");
                            CounterCollection.find({'Date': Time[1]}).toArray(function(Err, Items) {
                                Test.ok(Items.length==1, "Ensure that the time at the left edge of our interval of interest is still here.");
                                CounterCollection.find({'Date': Time[9]}).toArray(function(Err, Items) {
                                    Test.ok(Items.length==1, "Ensure that the time at the right edge of our interval of interest is still here.");
                                    Callback(Err);
                                });
                            });
                        });
                    });
                });
            }
        ],
        function(Err) {
            if(Err)
            {
                console.log(Err);
            }
            Test.done();
        });
    }
};

var Server = null;
var App, InnerApp, InnerAppRouter;

exports.BuildFullPath = {
    'setUp': function(Callback) {
        App = Express();
        function ReturnFullPath(Router) {
            return function (Req, Res) {
                Res.json({'FullPath': TrafficCounter.UnitTestCalls.BuildFullPath(Req, Router)});
            }
        }
        App.get('/', ReturnFullPath(App));
        App.get('/test', ReturnFullPath(App));
        App.get('/test/:id', ReturnFullPath(App));
        InnerApp = Express();
        InnerApp.get('/', ReturnFullPath(InnerApp));
        InnerApp.get('/test', ReturnFullPath(InnerApp));
        InnerApp.get('/test/:id', ReturnFullPath(InnerApp));
        App.use('/InnerApp/:Innerid', InnerApp);
        InnerAppRouter = Express.Router();
        InnerAppRouter.get('/', ReturnFullPath(InnerAppRouter));
        InnerAppRouter.get('/test', ReturnFullPath(InnerAppRouter));
        InnerAppRouter.get('/test/:id', ReturnFullPath(InnerAppRouter));
        App.use('/InnerAppRouter', InnerAppRouter);
        App.use('/Use', ReturnFullPath(App));
        App.use(function(Req, Res) {
            console.error('Unproccessed Request');
        });
        App.use(function(Err, Req, Res, Next) {
            console.error('Request Caused Error');
        });
        Server = Http.createServer(App);
        Server.listen(8080, function() {
            Callback();
        });
    },
    'tearDown': function(Callback) {
        Server.close(function() {
            Callback();
        });
    },
    'TestBuildFullPath': function(Test) {
        Test.expect(10);
        function EnsurePath(Path, Expected, Callback)
        {
            var Req = Http.request({'hostname': 'localhost', 'port': 8080, 'method': 'GET', 'path': Path, 'headers': {'Accept': 'application/json'}}, function(Res) {
                Res.setEncoding('utf8');
                Res.on('data', function (Chunk) {
                    var Body = JSON.parse(Chunk);
                    Test.ok(Body['FullPath']==Expected, "Confirming building of paths works");
                    Callback();
                });
            });
            Req.end();
        }
        Nimble.series([
            function(Callback) {
                EnsurePath('/', '/', Callback);
            },
            function(Callback) {
                EnsurePath('/test', '/test', Callback);
            },
            function(Callback) {
                EnsurePath('/test/1', '/test/:id', Callback);
            },
            function(Callback) {
                EnsurePath('/InnerApp/1', '/InnerApp/:Innerid', Callback);
            },
            function(Callback) {
                EnsurePath('/InnerApp/1/test', '/InnerApp/:Innerid/test', Callback);
            },
            function(Callback) {
                EnsurePath('/InnerApp/1/test/1', '/InnerApp/:Innerid/test/:id', Callback);
            },
            function(Callback) {
                EnsurePath('/InnerAppRouter', '/InnerAppRouter', Callback);
            },
            function(Callback) {
                EnsurePath('/InnerAppRouter/test', '/InnerAppRouter/test', Callback);
            },
            function(Callback) {
                EnsurePath('/InnerAppRouter/test/1', '/InnerAppRouter/test/:id', Callback);
            },  
            function(Callback) {
                EnsurePath('/Use', '/Use', Callback);
            }], 
            function(Err) {
                Test.done();
            });
    }
};

exports.TestIncrement = {
    'setUp': function(Callback) {
        MongoDB.MongoClient.connect("mongodb://localhost:27017/"+RandomIdentifier, {native_parser:true}, function(Err, DB) {
            if(Err)
            {
                console.log(Err);
            }
            Context = TrafficCounter;
            Context.Setup(DB, Callback);
        });
    },
    'tearDown': function(Callback) {
        Context.DB.dropDatabase(function(Err, Result) {
            if(Err)
            {
                console.log(Err);
            }
            Context.DB.close();
            Context = {};
            TrafficCounter.UnitTestCalls.ClearMemory();
            Callback();
        });
    },
    'TestIncrement': function(Test) {
        Test.expect(2);
        var Now = TrafficCounter.UnitTestCalls.TruncateNow();
        TrafficCounter.UnitTestCalls.EnsurePathDependencies.call(Context, {'Path': 'Test', 'Length': 9, 'Now': Now}, function(Err) {
            Context.DB.collection('Test:TrafficCounter', function(Err, CounterCollection) {
                TrafficCounter.UnitTestCalls.Increment.call(Context, {'Path': 'Test', 'Now': Now}, function(Err) {
                    CounterCollection.find({'Date': Now}).toArray(function(Err, Items) {
                        Test.ok(Items[0].Views==1, "Confirming that the first insertion is successful.");
                        TrafficCounter.UnitTestCalls.Increment.call(Context, {'Path': 'Test', 'Now': Now}, function(Err) {
                            CounterCollection.find({'Date': Now}).toArray(function(Err, Items) {
                                Test.ok(Items[0].Views==2, "Confirming that subsequent insertions are successful.");
                                Test.done();
                            });
                        });
                    });
                });
            });
        });
    }
};

exports.TestGetPaths = {
    'setUp': function(Callback) {
        MongoDB.MongoClient.connect("mongodb://localhost:27017/"+RandomIdentifier, {native_parser:true}, function(Err, DB) {
            if(Err)
            {
                console.log(Err);
            }
            Context = TrafficCounter;
            Context.Setup(DB, Callback);
        });
    },
    'tearDown': function(Callback) {
        Context.DB.dropDatabase(function(Err, Result) {
            if(Err)
            {
                console.log(Err);
            }
            Context.DB.close();
            Context = {};
            TrafficCounter.UnitTestCalls.ClearMemory();
            Callback();
        });
    },
    'TestGetPaths': function(Test) {
        Test.expect(3);
        TrafficCounter.UnitTestCalls.GetPaths.call(Context, function(Err, Items) {
            Test.ok(Items.length===0, "Confirming the default path list returned when there is no path is an empty array.");
            TrafficCounter.UnitTestCalls.EnsurePathDependencies.call(Context, {'Path': 'Test', 'Length': 9, 'Now': new Date()}, function(Err) {
                TrafficCounter.UnitTestCalls.GetPaths.call(Context, function(Err, Items) {
                    Test.ok(Items.length===1 && Items[0].Path==='Test', "Confirming that path list contains an added path.");
                    TrafficCounter.UnitTestCalls.EnsurePathDependencies.call(Context, {'Path': 'Test2', 'Length': 9, 'Now': new Date()}, function(Err) {
                        TrafficCounter.UnitTestCalls.GetPaths.call(Context, function(Err, Items) {
                            var ItemsAsPaths = Items.map(function(Item, Index, List) {
                                return(Item.Path);
                            });
                            Test.ok(Items.length===2 && ItemsAsPaths.indexOf('Test') >= 0 && ItemsAsPaths.indexOf('Test2') >= 0, "Confirming that path list contains an added paths.");
                            Test.done();
                        });
                    });
                });
            });
        });
    }
};

exports.TestGetTraffic = {
    'setUp': function(Callback) {
        MongoDB.MongoClient.connect("mongodb://localhost:27017/"+RandomIdentifier, {native_parser:true}, function(Err, DB) {
            if(Err)
            {
                console.log(Err);
            }
            Context = TrafficCounter;
            Context.Setup(DB, Callback);
        });
    },
    'tearDown': function(Callback) {
        Context.DB.dropDatabase(function(Err, Result) {
            if(Err)
            {
                console.log(Err);
            }
            Context.DB.close();
            Context = {};
            TrafficCounter.UnitTestCalls.ClearMemory();
            Callback();
        });
    },
    'TestGetTraffic': function(Test) {
        Test.expect(12);
        var Now = TrafficCounter.UnitTestCalls.TruncateNow(TrafficCounter.TimeUnit.Hour);
        Nimble.series([
            function(Callback) {
                TrafficCounter.UnitTestCalls.EnsurePathDependencies.call(Context, {'Path': 'Test', 'Length': 9, 'Now': Now}, function(Err) {
                    TrafficCounter.GetTraffic({'Path': 'Test', 'TimeUnit': TrafficCounter.TimeUnit.Hour, 'Length': 5, 'ReferenceTime': Now}, function(Err, Result) {
                        var AllZeroViews = Result.every(function(Item, Index, List) {
                            return(Item.Views==0);
                        });
                        Test.ok(AllZeroViews, "Confirm that vectorial traffic have all zero views for all recorded time intervals by default.");
                        TrafficCounter.GetTraffic({'Path': 'Test', 'TimeUnit': TrafficCounter.TimeUnit.Hour, 'Length': 5, 'ReferenceTime': Now, 'Cumulative': true}, function(Err, Result) {
                            Test.ok(Result===0, "Confirming that cumulative traffic with no data returns 0.");
                            Callback();
                        });
                    });
                });
            },
            function(Callback) {
                TrafficCounter.UnitTestCalls.Increment.call(Context, {'Path': 'Test', 'Now': Now}, function(Err) {
                    TrafficCounter.GetTraffic({'Path': 'Test', 'TimeUnit': TrafficCounter.TimeUnit.Hour, 'Length': 5, 'ReferenceTime': Now}, function(Err, Result) {
                        var Sum = Result.reduce(function(Prev , Item, Index, List) {
                            return Prev+Item.Views;
                        }, 0);
                        Test.ok(Sum==1, "Confirm that vectorial traffic works after first increment.");
                        TrafficCounter.GetTraffic({'Path': 'Test', 'TimeUnit': TrafficCounter.TimeUnit.Hour, 'Length': 5, 'ReferenceTime': Now, 'Cumulative': true}, function(Err, Result) {
                            Test.ok(Result===1, "Confirming that cumulative traffic works after first increment.");
                                Callback();
                        });
                    });
                });
            },
            function(Callback) {
                var Calls = [];
                var Additive = 1;
                while(Additive<=4)
                {
                    Calls.push((function(Callback) {
                        var Amount = Math.pow(10, this.Additive);
                        var ReferenceTime = TrafficCounter.TruncateTime(TrafficCounter.TimeUnit.Hour, Now, this.Additive);
                        TrafficCounter.UnitTestCalls.EnsurePathDependencies.call(Context, {'Path': 'Test', 'Length': 9, 'Now': TrafficCounter.TruncateTime(TrafficCounter.TimeUnit.Hour, Now, this.Additive)}, function(Err) {
                            TrafficCounter.UnitTestCalls.Increment.call(Context, {'Path': 'Test', 'Now': ReferenceTime, 'Amount': Amount}, function(Err) {
                                Callback();
                            });
                        });
                    }).bind({'Additive': Additive}));
                    Additive+=1;
                }
                Nimble.series(Calls, Callback);
            }, 
            function(Callback) {
                Context.DB.collection('Test:TrafficCounter', {'strict': true}, function(Err, ViewsCounterCollection) {
                    ViewsCounterCollection.find({}).toArray(function(Err, Items) {
                        //console.log(Items);
                        Callback();
                    });
                });
            },
            function(Callback) {
                TrafficCounter.GetTraffic({'Path': 'Test', 'TimeUnit': TrafficCounter.TimeUnit.Hour, 'Length': 1, 'ReferenceTime': TrafficCounter.TruncateTime(TrafficCounter.TimeUnit.Hour, Now, 1), 'Cumulative': true}, function(Err, Result) {
                    Test.ok(Result===11, "Confirming that cumulative traffic works at the leftmost intervals.");
                    TrafficCounter.GetTraffic({'Path': 'Test', 'TimeUnit': TrafficCounter.TimeUnit.Hour, 'Length': 2, 'ReferenceTime': TrafficCounter.TruncateTime(TrafficCounter.TimeUnit.Hour, Now, 4), 'Cumulative': true}, function(Err, Result) {
                        Test.ok(Result===11100, "Confirming that cumulative traffic works at the rightmost intervals.");
                        TrafficCounter.GetTraffic({'Path': 'Test', 'TimeUnit': TrafficCounter.TimeUnit.Hour, 'Length': 10, 'ReferenceTime': TrafficCounter.TruncateTime(TrafficCounter.TimeUnit.Hour, Now, 4), 'Cumulative': true}, function(Err, Result) {
                            Test.ok(Result===11111, "Confirming that cumulative traffic works over a range bigger than recorded intervals.");
                            TrafficCounter.GetTraffic({'Path': 'Test', 'TimeUnit': TrafficCounter.TimeUnit.Hour, 'Length': 5, 'ReferenceTime': TrafficCounter.TruncateTime(TrafficCounter.TimeUnit.Hour, Now, 20), 'Cumulative': true}, function(Err, Result) {
                                Test.ok(Result===0, "Confirming that cumulative traffic works over a range disjoint from recorded intervals.");
                                Callback();
                            });
                        });
                    });
                });
            },
            function(Callback) {
                TrafficCounter.GetTraffic({'Path': 'Test', 'TimeUnit': TrafficCounter.TimeUnit.Hour, 'Length': 1, 'ReferenceTime': TrafficCounter.TruncateTime(TrafficCounter.TimeUnit.Hour, Now, 1)}, function(Err, Result) {
                    var Sum = Result.reduce(function(Prev, Item, Index, List) {
                        return(Prev+Item.Views);
                    }, 0);
                    Test.ok(Sum===11, "Confirming that vectorial traffic works at the leftmost intervals.");
                    TrafficCounter.GetTraffic({'Path': 'Test', 'TimeUnit': TrafficCounter.TimeUnit.Hour, 'Length': 2, 'ReferenceTime': TrafficCounter.TruncateTime(TrafficCounter.TimeUnit.Hour, Now, 4)}, function(Err, Result) {
                        Sum = Result.reduce(function(Prev, Item, Index, List) {
                            return(Prev+Item.Views);
                        }, 0);
                        Test.ok(Sum===11100, "Confirming that vectorial traffic works at the rightmost intervals.");
                        TrafficCounter.GetTraffic({'Path': 'Test', 'TimeUnit': TrafficCounter.TimeUnit.Hour, 'Length': 10, 'ReferenceTime': TrafficCounter.TruncateTime(TrafficCounter.TimeUnit.Hour, Now, 4)}, function(Err, Result) {
                            Sum = Result.reduce(function(Prev, Item, Index, List) {
                                return(Prev+Item.Views);
                            }, 0);
                            Test.ok(Sum===11111, "Confirming that vectorial traffic works over a range bigger than recorded intervals.");
                            TrafficCounter.GetTraffic({'Path': 'Test', 'TimeUnit': TrafficCounter.TimeUnit.Hour, 'Length': 5, 'ReferenceTime': TrafficCounter.TruncateTime(TrafficCounter.TimeUnit.Hour, Now, 20)}, function(Err, Result) {
                                Sum = Result.reduce(function(Prev, Item, Index, List) {
                                    return(Prev+Item.Views);
                                }, 0);
                                Test.ok(Sum===0, "Confirming that vectorial traffic works over a range disjoint from recorded intervals.");
                                Callback();
                            });
                        });
                    });
                });
            }], 
            function(Err) {
                Test.done();
            }
        );
    }
};

exports.ErrorHandling = {
    'setUp': function(Callback) {
        MongoDB.MongoClient.connect("mongodb://localhost:27017/"+RandomIdentifier, {native_parser:true}, function(Err, DB) {
            Context = TrafficCounter;
            Context.Setup(DB, function(Err) {
                if(Err)
                {
                    console.log(Err);
                }
                TrafficCounter.UnitTestCalls.ClearMemory();
                Context.DB.dropDatabase(function(Err, Result) {
                    if(Err)
                    {
                        console.log(Err);
                    }
                    Context.DB.close();
                    Callback();
                });
            });
        });
    },
    'tearDown': function(Callback) {
        Context = {};
        Callback();
    },
    'TestEnsureSharedDependencies': function(Test) {
        Test.expect(2);
        TrafficCounter.once(TrafficCounter.Event.Error, function(Err) {
            Test.ok(Err, "Confirming that library triggered event on error.");
        });
        TrafficCounter.UnitTestCalls.EnsureSharedDependencies.call(Context, function(Err) {
            Test.ok(Err, "Confirming that library handled the error.");
            setTimeout(function() {
                Test.done();
            }, 100);
        });
    },
    'TestEnsurePathCoreDependencies': function(Test) {
        Test.expect(2);
        TrafficCounter.once(TrafficCounter.Event.RequestError, function(Err) {
            Test.ok(Err, "Confirming that library triggered event on error.");
        });
        TrafficCounter.UnitTestCalls.EnsurePathCoreDependencies.call(Context, {'Path': 'Test', 'Length': 10}, function(Err) {
            Test.ok(Err, "Confirming that library handled the error.");
            setTimeout(function() {
                Test.done();
            }, 100);
        });
    },
    'TestEnsurePathDependencies': function(Test) {
        Test.expect(2);
        TrafficCounter.once(TrafficCounter.Event.RequestError, function(Err) {
            Test.ok(Err, "Confirming that library triggered event on error.");
        });
        TrafficCounter.UnitTestCalls.EnsurePathDependencies.call(Context, {'Path': 'Test', 'Length': 10, 'Now': new Date()}, function(Err) {
            Test.ok(Err, "Confirming that library handled the error.");
            setTimeout(function() {
                Test.done();
            }, 100);
        });
    },
    'TestIncrement': function(Test) {
        Test.expect(2);
        TrafficCounter.once(TrafficCounter.Event.RequestError, function(Err) {
            Test.ok(Err, "Confirming that library triggered event on error.");
        });
        TrafficCounter.UnitTestCalls.Increment.call(Context, {'Path': 'Test', 'Now': new Date()}, function(Err) {
            Test.ok(Err, "Confirming that library handled the error.");
            setTimeout(function() {
                Test.done();
            }, 100);
        });
    },
    'TestGetPaths': function(Test) {
        Test.expect(2);
        TrafficCounter.once(TrafficCounter.Event.ReportError, function(Err) {
            Test.ok(Err, "Confirming that library triggered event on error.");
        });
        TrafficCounter.UnitTestCalls.GetPaths.call(Context, function(Err, Items) {
            Test.ok(Err, "Confirming that library handled the error.");
            setTimeout(function() {
                Test.done();
            }, 100);
        });
    },
    'TestGetTraffic': function(Test) {
        Test.expect(2);
        TrafficCounter.once(TrafficCounter.Event.ReportError, function(Err) {
            Test.ok(Err, "Confirming that library triggered event on error.");
        });
        TrafficCounter.GetTraffic({'Path': 'Test', 'TimeUnit': TrafficCounter.TimeUnit.Hour, 'Length': 5, 'ReferenceTime': new Date()}, function(Err, Result) {
            Test.ok(Err, "Confirming that library handled the error.");
            setTimeout(function() {
                Test.done();
            }, 100);
        });
    }
};

if(process.env['USER'] && process.env['USER']=='root')
{
    exports.NonResponsiveHandling = {
        'setUp': function(Callback) {
            MongoDB.MongoClient.connect("mongodb://localhost:27017/"+RandomIdentifier, {native_parser:true}, function(Err, DB) {
                Context['DB'] = DB;
                Context.DB.command({'serverStatus': 1}, function(Err, Result) {
                    Context['PID'] = Result.pid;
                    process.kill(Context.PID, 'SIGSTOP');
                    Callback();
                });
            });
        },
        'tearDown': function(Callback) {
            process.kill(Context.PID, 'SIGCONT');
            Context.DB.dropDatabase(function(Err, Result) {
                if(Err)
                {
                    console.log(Err);
                }
                Context.DB.close();
                Context['DB'] = null;
                Context['PID'] = null
                Callback();
            });
        },
        'TestEnsureSharedDependencies': function(Test) {
            Test.expect(0);
            Test.done();
        },
        'TestEnsurePathCoreDependencies': function(Test) {
            Test.expect(0);
            Test.done();
        },
        'TestEnsurePathDependencies': function(Test) {
            Test.expect(0);
            Test.done();
        },
        'TestIncrement': function(Test) {
            Test.expect(0);
            Test.done();
        },
        'TestGetPaths': function(Test) {
            Test.expect(0);
            Test.done();
        },
        'TestGetTraffic': function(Test) {
            Test.expect(0);
            Test.done();
        }
    };
}

process.on('uncaughtException', function(MainErr) {
    if(Context.DB)
    {
        Context.DB.dropDatabase(function(Err, Result) {
            if(Err)
            {
                console.log(Err);
            }
            console.log('Caught exception: ' + MainErr);
            process.exit(1);
        });
    }
    else
    {
        console.log('Caught exception: ' + MainErr);
        process.exit(1);
    }
});
