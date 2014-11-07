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

var MongoDB = require('mongodb');
var TrafficCounter = require('../lib/TrafficCounter');
var Nimble = require('nimble');

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

var Context = {};
var RandomIdentifier = 'TrafficCounterTestDB'+Math.random().toString(36).slice(-8);

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

if(process.env['USER'] && process.env['USER']=='root')
{
    exports.ErrorHandling = {
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
        }
    };
}

exports.TestIncrement = function(Test) {
    Test.expect(0);
    Test.done();
};

exports.TestBuildFullPath = function(Test) {
    Test.expect(0);
    Test.done();
};

exports.TestGetTraffic = function(Test) {
    Test.expect(0);
    Test.done();
};

exports.TestGetPaths = function(Test) {
    Test.expect(0);
    Test.done();
};
