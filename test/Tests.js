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

var TrafficCounter = require('../lib/TrafficCounter');

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
    TrafficCounter.UnitCalls['HandleError'].call(TrafficCounter, Error, UnexpectedErrorCall, ExpectedErrorCall, TrafficCounter.Event.Test);
    setTimeout(function() {
        Error = 1;
        TrafficCounter.UnitCalls['HandleError'].call(TrafficCounter, Error, ExpectedErrorCall, UnexpectedErrorCall, null);
        setTimeout(function() {
            TrafficCounter.removeListener(TrafficCounter.Event.Test, UnexpectedErrorEvent);
            TrafficCounter.once(TrafficCounter.Event.Test, ExpectedErrorEvent);
            
            Error = 2;
            TrafficCounter.UnitCalls['HandleError'].call(TrafficCounter, Error, ExpectedErrorCall, UnexpectedErrorCall, TrafficCounter.Event.Test);
            setTimeout(function() {
                Test.done();
            }, 100);
        }, 100);
    }, 100);
};

exports.TestEnsureSharedDependencies = function(Test) {
    Test.expect(0);
    Test.done();
};

exports.TestEnsurePathCoreDependencies = function(Test) {
    Test.expect(0);
    Test.done();
};

exports.TestEnsurePathDependencies = function(Test) {
    Test.expect(0);
    Test.done();
};

exports.TestEnsureSharedDependencies = function(Test) {
    Test.expect(0);
    Test.done();
};

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
