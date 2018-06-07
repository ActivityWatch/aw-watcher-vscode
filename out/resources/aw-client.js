"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require('request');
/**
 * @description Client for connecting to the ActivityWatch API
 */
class AWClient {
    constructor(isTest = true) {
        this._isTest = isTest;
    }
    createBucket(bucket) {
        const apiMethod = `${bucket.id}`;
        // const args = this._bucket;
        const args = {
            client: bucket.clientName,
            hostname: bucket.hostName,
            type: bucket.eventType
        };
        return new Promise((resolve, reject) => {
            this._apiCall(apiMethod, args, 'POST')
                .then(() => resolve('Created new bucket'))
                .catch(({ err, httpResponse, data }) => {
                // Server returns statusCode 304 if bucket existed
                if (httpResponse && httpResponse.hasOwnProperty('statusCode') && httpResponse.statusCode === 304) {
                    resolve('Bucket already exists');
                }
                else {
                    reject(err);
                }
            });
        });
    }
    getBucket(bucketId) {
        const apiMethod = `${bucketId}`;
        return this._apiCall(apiMethod);
    }
    deleteBucket(bucketId) {
        const apiMethod = `${bucketId}`;
        return this._apiCall(apiMethod, {}, 'DELETE');
    }
    sendEvent(bucketId, event) {
        const apiMethod = `${bucketId}/events`;
        const args = {
            timestamp: event.timestamp,
            duration: event.duration,
            data: event.data
        };
        return this._apiCall(apiMethod, args, 'POST');
    }
    getEvents(bucketId) {
        const apiMethod = `${bucketId}/events`;
        return this._apiCall(apiMethod);
    }
    sendHearbeat(bucketId, event, pulsetime) {
        const apiMethod = `${bucketId}/heartbeat?pulsetime=${pulsetime}`;
        const args = {
            timestamp: event.timestamp,
            duration: event.duration,
            data: event.data
        };
        return this._apiCall(apiMethod, args, 'POST');
    }
    /**
     * @description Makes an api call to the ActivityWatch API
     * @example <caption>Example showing how to create a bucket</caption>
     * const apiMethod = '<bucket_id>';
     * const args = {
     *   client: 'aw-watcher-<name>',
     *   hostname: '<computer-name>',
     *   type: '<type>'
     * };
     * this._apiCall(apiMethod, args, 'POST')
     *   .then((data, httpResponse, err) => console.log('Bucket created'))
     *   .catch((err, httpResponse, data) => {
     *     // Server returns statusCode 304 if bucket existed
     *     if (httpResponse === 304) {
     *       console.log('Bucket existed');
     *     }
     *     else {
     *      console.error('Error while creating bucket', err);
     *     }
     *   })
     * }
     *
     * @param {string}  apiMethod   the name of the api method
     * @param {object}  args        all arguments passed as questionString/body
     * @param {string}  httpMethod  the method to use (GET/POST/DELETE/PUT)
     * @returns {Promise<{ err: string, httpResponse: { [k: string]: any }, data: { [k: string]: any } }>} Promise with object containing 'err', 'data', and 'httpResponse'
     */
    _apiCall(apiMethod, args = {}, httpMethod = 'GET') {
        const uri = `${this._apiEndpoint}${apiMethod}`;
        const requestOptions = {
            uri,
            method: httpMethod,
            json: true
        };
        switch (httpMethod) {
            case 'GET':
            case 'DELETE':
                requestOptions.qs = args;
                break;
            case 'POST':
            case 'PUT':
                requestOptions.body = args;
        }
        return new Promise((resolve, reject) => {
            request(requestOptions, (err, httpResponse, data) => {
                if (err || httpResponse.statusCode !== 200) {
                    return reject({ err, httpResponse, data });
                }
                resolve({ data, httpResponse, err });
            });
        });
    }
    get _apiEndpoint() {
        return `${this._host}/api/0/buckets/`;
    }
    get _host() {
        const port = (this._isTest) ? '5666' : '5600';
        return `http://localhost:${port}`;
    }
}
exports.default = AWClient;
//# sourceMappingURL=aw-client.js.map