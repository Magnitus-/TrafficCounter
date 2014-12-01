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
var Events = require('events');
var Util = require('util');

var TimeUnit = {'Minute': 0, 'Hour': 1, 'Day': 2, 'Month': 3};
var Event = {'GetPaths': 'GetPaths', 'GetTraffic': 'GetTraffic', 'SetupFinished': 'SetupFinished', 'Error': 'error', 'RequestError': 'RequestError', 'ReportError': 'ReportError', 'Test': 'Test'}

function TruncateTime(TimeUnitParam, Time, Modifier)
{
    if(TimeUnitParam==TimeUnit.Month)
    {
        return(new Date(Time.getFullYear(), Time.getMonth()+Modifier));
    }
    else if(TimeUnitParam==TimeUnit.Day)
    {
        return(new Date(Time.getFullYear(), Time.getMonth(), Time.getDate()+Modifier));
    }
    else if(TimeUnitParam==TimeUnit.Hour)
    {
        return(new Date(Time.getFullYear(), Time.getMonth(), Time.getDate(), Time.getHours()+Modifier));
    }
    else
    {
        return(new Date(Time.getFullYear(), Time.getMonth(), Time.getDate(), Time.getHours(), Time.getMinutes()+Modifier));
    }
}

function TruncateNow(TimeUnitParam)
{
    var Now = new Date();
    return(TruncateTime(TimeUnitParam, Now, 0));
}

function GetDiscreteSteps(Before, After, TimeUnitParam) //Assumes truncated time input
{
    var Result = [];
    //Probably should eventually be shortened by exploiting the symmetry in the branches
    if(TimeUnitParam==TimeUnit.Month)
    {
        var Index = new Date(Before.getFullYear(), Before.getMonth());
        while(Index<After)
        {
            Index.setMonth(Index.getMonth()+1);
            Result.push(new Date(Index.getFullYear(), Index.getMonth()));
        }
    }
    else if(TimeUnitParam==TimeUnit.Day)
    {
        var Index = new Date(Before.getFullYear(), Before.getMonth(), Before.getDate());
        while(Index<After)
        {
            Index.setDate(Index.getDate()+1);
            Result.push(new Date(Index.getFullYear(), Index.getMonth(), Index.getDate()));
        }
    }
    else if(TimeUnitParam==TimeUnit.Hour)
    {
        var Index = new Date(Before.getFullYear(), Before.getMonth(), Before.getDate(), Before.getHours());
        while(Index<After)
        {
            Index.setHours(Index.getHours()+1);
            Result.push(new Date(Index.getFullYear(), Index.getMonth(), Index.getDate(), Index.getHours()));
        }
    }
    else
    {
        var Index = new Date(Before.getFullYear(), Before.getMonth(), Before.getDate(), Before.getHours(), Before.getMinutes());
        while(Index<After)
        {
            Index.setMinutes(Index.getMinutes()+1);
            Result.push(new Date(Index.getFullYear(), Index.getMonth(), Index.getDate(), Index.getHours(), Index.getMinutes()));
        }
    }
    return(Result);
}

function GenerateTCConstructor() {//Closure simulates private/internal class members    
    LastDateByPath = {};
    
    function HandleError(Err, ErrCallback, OkCallback, ErrEmitKey)
    {
        if(Err)
        {
            if(ErrEmitKey)
            {
                this.emit(ErrEmitKey, Err);
            }
            if(ErrCallback)
            {
                ErrCallback(Err);
            }
        }
        else
        {
            OkCallback();
        }
    }
    
    function EnsureSharedDependencies(Callback)
    {
        var Context = this;
        var DB = this.DB;
        DB.createCollection('DefinedPaths', {'w': 1}, function(Err, DefinedPathsCollection) {
            HandleError.call(Context, Err, Callback, function() {
                DefinedPathsCollection.ensureIndex({'Path': 1}, {'unique': true}, function(Err, Index) {});
                if(Callback)
                {
                    Callback();
                }
            }, Event.Error);
        });
    }
    
    function EnsurePathCoreDependencies(Params, Callback)
    {
        var Context = this;
        var DB = this.DB;
        DB.collection('DefinedPaths', function(Err, DefinedPathsCollection) {
            HandleError.call(Context, Err, Callback, function() {
                DefinedPathsCollection.findAndModify({'Path': Params['Path']}, [['Path', 1]], {'$setOnInsert': {'Path': Params['Path']}}, {'w': 1, 'upsert': true, 'new': true}, function(Err, Item) {
                    HandleError.call(Context, Err, Callback, function() {
                        SizeCalcDummy = {'Views': 1, 'Date': new Date(), '_id': new MongoDB.ObjectID()};
                        DB.createCollection(Params['Path']+':TrafficCounter', {"capped" : true, "size" : MongoDB.BSON.calculateObjectSize(SizeCalcDummy)*Params['Length']*2, "max" : Params['Length'], 'w': 1}, function(Err, ViewsCounterCollection) {
                            HandleError.call(Context, Err, Callback, function() {
                                ViewsCounterCollection.ensureIndex({'Date': 1}, {'unique': true}, function(Err, Index) {});
                                if(Callback)
                                {
                                    Callback();
                                }
                            }, Event.RequestError);
                        });
                    }, Event.RequestError);
                });
            }, Event.RequestError);
        });
    }
    
    
    /* 
    //May be needed in the future to ensure insertion order correctness in rare race cases for extremely low traffic sites running several node/Express processes
    //However, given that the above doesn't reflect a sane deployment strategy (combined with the fact that it's rare, won't crash anything and will just introduce possible temporary innacuracies in the reporting of the data), this is low priority
    function LockInsertion(Params, Callback)
    {
        //Will need to be a double-request, first one to get insert lock and the one below to verify/infor we have the latest date
        DefinedPathsCollection.findAndModify({'$and': [{'Path': Params['Path']}, {'$or': [{'LastDate': null}, {'LastDate': {'$lt': Params['Now']}}]}]}, [['Path', 1]], {'$set': {'LastDate': Params['Now']}}, {'w': 1, 'new': true}, function(Err, Item) {
        });
    }
    
    function FreeInsertion(Params, Callback)
    {
        //this would just free the insert lock
    }*/
    
    function EnsurePathDependencies(Params, Callback)
    {
        var Context = this;
        var Now = Params['Now'];
        var DB = this.DB;
        var Path = Params['Path'];
        if(LastDateByPath[Path]===undefined)
        {
            EnsurePathCoreDependencies.call(Context, Params, function(Err) {
                HandleError.call(Context, Err, Callback, function() {
                    DB.collection(Params['Path']+':TrafficCounter', function(Err, ViewsCounterCollection) {
                        HandleError.call(Context, Err, Callback, function() {
                            ViewsCounterCollection.findAndModify({'Date': Now}, [['Date', 1]], {'$setOnInsert': {'Views': 0, 'Date': Now}}, {'w': 1, 'upsert': true, 'new': true}, function(Err, Item) {
                                HandleError.call(Context, Err, Callback, function() {
                                    if((LastDateByPath[Path]===undefined)||(Now > LastDateByPath[Path]))
                                    {
                                        LastDateByPath[Path] = Now;
                                    }
                                    if(Callback)
                                    {
                                        Callback();
                                    }
                                }, Event.RequestError);
                            });
                        }, Event.RequestError);
                    });
                });
            });
        }
        else if(Now > LastDateByPath[Path])
        {
            DB.collection(Path+':TrafficCounter', {'strict': true}, function(Err, ViewsCounterCollection) {
                 HandleError.call(Context, Err, Callback, function() {
                     ViewsCounterCollection.findAndModify({'Date': Now}, [['Date', 1]], {'$setOnInsert': {'Views': 0, 'Date': Now}}, {'w': 1, 'upsert': true, 'new': true}, function(Err, Item) {
                         HandleError.call(Context, Err, Callback, function() {
                             if(Now > LastDateByPath[Path])
                             {
                                 LastDateByPath[Path] = Now;
                             }
                             if(Callback)
                             {
                                 Callback();
                             }
                         }, Event.RequestError);
                     });
                 }, Event.RequestError);
            });
        }
        else
        {
            if(Callback)
            {
                Callback();
            }
        }
        
    }
    
    function Increment(Params, Callback) 
    {
        var Context = this;
        var DB = this.DB;
        var Event = this.Event;
        var Amount = Params['Amount'] ? Params['Amount'] : 1;
        DB.collection(Params['Path']+':TrafficCounter', {'strict': true}, function(Err, ViewsCounterCollection) {
            HandleError.call(Context, Err, Callback, function() {
                ViewsCounterCollection.update({'Date': Params['Now']}, {"$inc" : {"Views" : Amount}}, {'w': 0});
                if(Callback)
                {
                    Callback();
                }
            }, Event.RequestError)
        });
    }
    
    function BuildFullPath(Req, App)
    {
        var ToReturn = "";
        if(App.mountpath && App.mountpath != '/') //use(SomePath, express())
        {
            ToReturn = App.mountpath.toString();
        }
        else if(Req.baseUrl.length > 0 && Req.baseUrl != '/') //use(SomePath, express.Router())
        {
            ToReturn = Req.baseUrl;
        }
        if(Req.route&&(!(Req.route.path == '/' && ToReturn.length > 0)))
        {
            ToReturn += Req.route.path;
        }
        return(ToReturn);
    }
    
    //Args = ReferenceTime (optional), TimeUnit, Length, Path, Cumulative (optional)
    function GetTraffic(Params, Callback)
    {
        var Context = this;
        var DB = this.DB;
        Params['ReferenceTime'] = Params['ReferenceTime'] ? Params['ReferenceTime'] : new Date();
        var Then = TruncateTime(Params['TimeUnit'], Params['ReferenceTime'], -Params['Length']);
        DB.collection(Params['Path']+':TrafficCounter', {'strict': true}, function(Err, ViewsCounterCollection) {
            HandleError.call(Context, Err, Callback, function() {
                if(!Params['Cumulative'])
                {
                    ViewsCounterCollection.find({'Date': {'$gte': Then, '$lte': Params['ReferenceTime']}}).sort({"$natural" : 1}).toArray(function(Err, Items) {
                        HandleError.call(Context, Err, Callback, function() {
                            Context.emit(Event.GetTraffic, Params, Items);
                            if(Callback)
                            {
                                Callback(null, Items);
                            }
                        }, Event.ReportError);
                    });
                }
                else
                {
                    ViewsCounterCollection.aggregate([{'$match' : {'Date': {'$gte': Then, '$lte': Params['ReferenceTime']}}}, 
                                                      {"$project" : {"Views": 1, "_id" : 0}}, 
                                                      {"$group" : {"_id" : 0, "Views": {"$sum" : "$Views"}}}], function(Err, Result) {
                        HandleError.call(Context, Err, Callback, function() {
                            var Views = 0;
                            if(Result.length>0)
                            {
                                Views = Result[0].Views;
                            }
                            Context.emit(Event.GetTraffic, Params, Views);
                            if(Callback)
                            {
                                Callback(null, Views);
                            }
                        }, Event.ReportError);
                    });
                }
            }, Event.ReportError);
        });
    }
    
    function GetPaths(Callback)
    {
        var Context = this;
        var DB = this.DB;
        DB.collection('DefinedPaths', {'strict': true}, function(Err, DefinedPathsCollection) {
            HandleError.call(Context, Err, Callback, function() {
                DefinedPathsCollection.find({}).toArray(function(Err, Items) {
                    HandleError.call(Context, Err, Callback, function() {
                        if(Callback)
                        {
                            Context.emit(Event.GetPaths, Items);
                            Callback(null, Items);
                        }
                    }, Event.ReportError);
                });
            }, Event.ReportError);
        });
    }
    
    function TrafficCounter()
    {
        Events.EventEmitter.call(this);
        this.Setup = function(DB, Callback, Timeout) {
            var Context = this;
            this.DB = DB;
            this.Timeout = Timeout ? Timeout : 100;
            EnsureSharedDependencies.call(Context, function(Err) {
                HandleError.call(Context, Err, Callback, function() {
                    Context.CountTraffic = function(TimeUnitParam, Length, App, PathParam) {
                        return(function(Req, Res, Next) {
                            Params = {'Length': Length, 'TimeUnit': TimeUnitParam, 'Now': TruncateNow(TimeUnitParam)};
                            if(!PathParam)
                            {
                                PathParam = BuildFullPath(Req, App);
                            }
                            Params['Path'] = PathParam;
                            EnsurePathDependencies.call(Context, Params, function(Err) {
                                HandleError.call(Context, Err, Next, function() {
                                    Increment.call(Context, Params, Next);
                                });
                            });
                        });
                    };
                    Context.GetTraffic = GetTraffic;
                    Context.GetPaths = GetPaths;
                    if(Callback)
                    {
                        Context.emit(Event.SetupFinished);
                        Callback();
                    }
                });
            });
        };
    }
    
    Util.inherits(TrafficCounter, Events.EventEmitter);
    TrafficCounter.prototype.TimeUnit = TimeUnit;
    TrafficCounter.prototype.Event = Event;
    TrafficCounter.prototype.TruncateTime = TruncateTime;
    
    //For unit tests
    TrafficCounter.prototype.UnitTestCalls = {}
    TrafficCounter.prototype.UnitTestCalls.HandleError = HandleError;
    TrafficCounter.prototype.UnitTestCalls.EnsureSharedDependencies = EnsureSharedDependencies;
    TrafficCounter.prototype.UnitTestCalls.EnsurePathCoreDependencies = EnsurePathCoreDependencies;
    TrafficCounter.prototype.UnitTestCalls.EnsurePathDependencies = EnsurePathDependencies;
    TrafficCounter.prototype.UnitTestCalls.Increment = Increment;
    TrafficCounter.prototype.UnitTestCalls.BuildFullPath = BuildFullPath;
    TrafficCounter.prototype.UnitTestCalls.GetPaths = GetPaths;
    TrafficCounter.prototype.UnitTestCalls.SetDateByPath = function(Arg) {
        LastDateByPath = Arg;
    };
    TrafficCounter.prototype.UnitTestCalls.TruncateTime = TruncateTime;
    TrafficCounter.prototype.UnitTestCalls.TruncateNow = TruncateNow;
    TrafficCounter.prototype.UnitTestCalls.ClearMemory = function() {
        LastDateByPath = {};
    };
    return TrafficCounter;
}

var TrafficCounter = GenerateTCConstructor();

module.exports = new TrafficCounter();

