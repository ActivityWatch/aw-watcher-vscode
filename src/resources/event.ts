/**
 * @description - ActivityWatch - Event
 */

export default class Event {
    private _timestamp: string;
    private _duration: number;
    private _data: { [k: string]: any };

    constructor({
        timestamp = new Date(),
        duration,
        data
    }: { timestamp: Date, duration: number, data: { [k: string]: any } }) {
        this._timestamp = timestamp.toISOString();
        this._duration = duration;
        this._data = data;
    }

    public get timestamp() {
        return this._timestamp;
    }

    public get duration() {
        return this._duration;
    }

    public get data() {
        return this._data;
    }
}