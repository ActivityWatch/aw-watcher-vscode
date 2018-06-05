const request = require('request');
import Event from './event';
import BucketInterface from './bucket.interface';

/**
 * @description Client for connecting to the ActivityWatch API
 */

export default class AWClient {
    private _isTest: boolean;

    constructor(isTest = true) {
        this._isTest = isTest;
    }

    public createBucket(bucket: BucketInterface): Promise<string> {
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
                    } else {
                        reject(err);
                    }
                });
        });
    }

    public getBucket(bucketId: string) {
        const apiMethod = `${bucketId}`;

        return this._apiCall(apiMethod);
    }

    public deleteBucket(bucketId: string) {
        const apiMethod = `${bucketId}`;
        
        return this._apiCall(apiMethod, {}, 'DELETE');
    }

    public sendEvent(bucketId: string, event: Event) {
        const apiMethod = `${bucketId}/events`;
        const args = {
            timestamp: event.timestamp,
            duration: event.duration,
            data: event.data
        };

        return this._apiCall(apiMethod, args, 'POST');
    }

    public getEvents(bucketId: string) {
        const apiMethod = `${bucketId}/events`;

        return this._apiCall(apiMethod);
    }

    public sendHearbeat(bucketId: string, event: Event, pulsetime: number) {
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
    private _apiCall(apiMethod: string, args = {}, httpMethod = 'GET'): Promise<{ err: string, httpResponse: { [k: string]: any }, data: { [k: string]: any } }> {
        const uri = `${this._apiEndpoint}${apiMethod}`;

        const requestOptions: { [k: string]: any } = {
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
            request(requestOptions, (err: string, httpResponse: { [k: string]: any }, data: object) => {
                if (err || httpResponse.statusCode !== 200) {
                    return reject({ err, httpResponse, data });
                }

                resolve({ data, httpResponse, err });
            });
        });
    }

    private get _apiEndpoint(): string {
        return `${this._host}/api/0/buckets/`;
    }

    private get _host(): string {
        const port = (this._isTest) ? '5666' : '5600';
        return `http://localhost:${port}`;
    }
}