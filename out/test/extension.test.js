"use strict";
//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'assert' provides assertion methods from node
const assert = require("assert");
const bucket_1 = require("../resources/bucket");
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as vscode from 'vscode';
// import * as myExtension from '../extension';
// Defines a Mocha test suite to group tests of similar kind together
describe('AW-Client Bucket', function () {
    const bucket = new bucket_1.default();
    beforeEach(function initBucket(done) {
        bucket.initBucket('aw-watcher-coding-test', 'mocha', 'coding.editor.project')
            .then(() => done())
            .catch(err => {
            done(new Error(err));
        });
    });
    describe('bucket', () => {
        it('[initBucket] should create aw-watcher-coding-test bucket without error', function (done) {
            bucket.initBucket('aw-watcher-coding-test', 'test', 'coding.editor.project')
                .then(() => done())
                .catch(err => {
                done(new Error(err));
            });
        });
        it('[getBucket] should retrieve bucket information for aw-watcher-coding-test', function (done) {
            bucket.getBucket()
                .then(({ data }) => {
                assert.equal('aw-watcher-coding-test_mocha', data.id);
                done();
            })
                .catch(err => done(new Error(err)));
        });
        it('[deleteBucket] should delete bucket without error', function (done) {
            bucket.deleteBucket()
                .then(() => bucket.getBucket())
                .then(() => done(new Error('got bucket information after deletion')))
                .catch(({ err, httpResponse, data }) => {
                assert.equal(httpResponse.statusCode, 404);
                done();
            });
        });
    });
    describe('events', () => {
        it('[sendEvent] should send event without errors', function (done) {
            const event = {
                timestamp: new Date().toISOString(),
                duration: 0,
                data: {
                    editor: 'vs-code',
                    project: 'aw-extension',
                    language: 'ts'
                }
            };
            bucket.sendEvent(undefined, event)
                .then(({ httpResponse, data }) => {
                done();
            })
                .catch(({ err, httpResponse }) => {
                done(new Error(err));
            });
        });
        it('[getEvents] should get previously created event', function (done) {
            bucket.getEvents()
                .then(({ httpResponse, data }) => {
                done();
            })
                .catch(({ err, httpResponse }) => {
                done(new Error(err));
            });
        });
    });
    describe('heartbeat', () => {
        it('[sendHeartbeat] should send heartbeat without errors', function (done) {
            const event = {
                timestamp: new Date().toISOString(),
                duration: 0,
                data: {
                    editor: 'vs-code',
                    project: 'aw-extension',
                    language: 'ts'
                }
            };
            bucket.sendHearbeat(undefined, event, 10)
                .then(() => done())
                .catch(({ err }) => done(new Error(err)));
        });
    });
});
//# sourceMappingURL=extension.test.js.map