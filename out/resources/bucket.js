"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aw_client_1 = require("./aw-client");
class Bucket extends aw_client_1.default {
    constructor(isTest = true) {
        super(isTest);
        this._bucket = {
            id: '',
            clientName: '',
            hostName: '',
            eventType: ''
        };
    }
    initBucket(clientName, hostName, eventType) {
        this._bucket.id = `${clientName}_${hostName}`;
        this._bucket.clientName = clientName;
        this._bucket.hostName = hostName;
        this._bucket.eventType = eventType;
        return this.createBucket();
    }
    getBucket() {
        return super.getBucket(this._bucket.id);
    }
    createBucket() {
        return super.createBucket(this._bucket);
    }
    deleteBucket() {
        return super.deleteBucket(this._bucket.id);
    }
    getEvents() {
        return super.getEvents(this._bucket.id);
    }
    // TODO: Check why removing the bucketId parameter results in a typescript error
    sendEvent(bucketId = this._bucket.id, event) {
        return super.sendEvent(this._bucket.id, event);
    }
    // TODO: Check why removing the bucketId parameter results in a typescript error
    sendHearbeat(bucketId = this._bucket.id, event, pulsetime) {
        return super.sendHearbeat(this._bucket.id, event, pulsetime);
    }
    get id() {
        return this._bucket.id;
    }
    get clientName() {
        return this._bucket.clientName;
    }
    get hostName() {
        return this._bucket.hostName;
    }
    get eventType() {
        return this._bucket.eventType;
    }
}
exports.default = Bucket;
//# sourceMappingURL=bucket.js.map