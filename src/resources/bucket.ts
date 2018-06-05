import AW_Client from './aw-client';
import Event from './event';
    
export default class Bucket extends AW_Client {
    private _bucket: {
        id: string;
        clientName: string;
        hostName: string;
        eventType: string;
    };

    constructor(isTest = true) {
        super(isTest);

        this._bucket = {
            id: '',
            clientName: '',
            hostName: '',
            eventType: ''
        };
    }

    public initBucket(clientName: string, hostName: string, eventType: string): Promise<string | Error> {
        this._bucket.id = `${clientName}_${hostName}`;
        this._bucket.clientName = clientName;
        this._bucket.hostName = hostName;
        this._bucket.eventType = eventType;

        return this.createBucket();
    }

    public getBucket() {
        return super.getBucket(this._bucket.id);
    }

    public createBucket() {
        return super.createBucket(this._bucket);
    }

    public deleteBucket() {
        return super.deleteBucket(this._bucket.id);
    }

    public getEvents() {
        return super.getEvents(this._bucket.id);
    }

    // TODO: Check why removing the bucketId parameter results in a typescript error
    public sendEvent(bucketId = this._bucket.id, event: Event) {
        return super.sendEvent(this._bucket.id, event);
    }

    // TODO: Check why removing the bucketId parameter results in a typescript error
    public sendHearbeat(bucketId = this._bucket.id, event: Event, pulsetime: number) {
        return super.sendHearbeat(this._bucket.id, event, pulsetime);
    }

    public get id() {
        return this._bucket.id;
    }
    public get clientName() {
        return this._bucket.clientName;
    }
    public get hostName() {
        return this._bucket.hostName;
    }
    public get eventType() {
        return this._bucket.eventType;
    }
}