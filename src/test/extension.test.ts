//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import AW_Client from '../aw-client.js';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as vscode from 'vscode';
// import * as myExtension from '../extension';

// Defines a Mocha test suite to group tests of similar kind together
describe("AWClient", function () {
    const client = new AW_Client();
      
    describe("bucket", () => {
        it('[initBucket] should create aw-watcher-coding-test bucket without error', function (done) {
            client.initBucket('aw-watcher-coding-test', 'test', 'coding.editor.project')
                .then(() => done())
                .catch(err => {
                    done(new Error(err));
                });
        });
        it('[getBucket] should retrieve bucket information for aw-watcher-coding-test', function (done) {
            client.getBucket()
                .then(({ data }) => {
                    assert.equal('aw-watcher-coding-test', data.client);
                    done();
                })
                .catch(err => done(new Error(err)));
        });
        it('[deleteBucket] should delete bucket without error', function (done) {
            client.deleteBucket()
                .then(() => client.getBucket())
                .then(() => done(new Error('got bucket information after deletion')))
                .catch(({ err, httpResponse, data }) => {
                    assert.equal(httpResponse.statusCode, 404);
                    done();
                });
        });
    });
});