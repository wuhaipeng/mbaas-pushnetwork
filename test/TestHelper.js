// Copyright 2013 [copyright owner]
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Test Helpers

/** Conditional describe
 *
 * Use:
 *    when(condition).describe("...", function () { ... });
 * When the condition is true, the normal describe will be used,
 * otherwise describe.skip will be used.
 */
exports.when = function (condition) {
    return condition ? {
        describe: function (description, tests) { describe(description, tests); }
    } : {
        describe: function (description, tests) {
            console.log("Skipped: " + description);
            describe.skip(description, tests);
        }
    };
};

/** Handle exception raised in async callback functions.
 * 
 * Exceptions raised in async callbacks can't be caught by Mocha framework
 * automatically, and this result in meaningless error report.
 * So for any async callbacks which will perform some assertions,
 * use asyncExpect to wrap it over.
 *
 * @param action the real callback function
 * @param done the done function passed from Mocha framework
 * @param more (optional) true if there are more async callbacks, so done will not be invoked
 */
exports.asyncExpect = function (action, done, more) {
    if (!done) {
        return action;
    }
    
    return function () {
        var err = undefined, result;
        try {
            result = action.apply(this, arguments);
        } catch (e) {
            err = e;
        }
        if (err) {
            done(err);
        } else if (!more) {
            done();
        }
        return result;
    };
};

/** The utility class for defining mocked methods */
exports.MockedClass = new Class({
    mock: function (method, mockedFn, sync) {
        var self = this;            
        if (typeof(mockedFn) == "function") {
            this[method] = sync ? mockedFn : function () {
                var args = arguments;
                process.nextTick(function () {
                    mockedFn.apply(self, args);
                });
            };
        } else {
            this[method] = function () { return mockedFn; };
        }
    }
});
