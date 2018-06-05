/**
 * @description Interface for ActivityWatch Events
 */

export default interface Event {
    timestamp: string;
    duration: number;
    data: { [k: string]: any };
}