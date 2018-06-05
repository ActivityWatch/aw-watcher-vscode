import Event from './event';

/**
 * @description template for the event type coding.editor.project
 */
export default class CodingEditorProjectEvent extends Event {
    constructor({
        timestamp = new Date(),
        duration,
        data
    }: {
        timestamp: Date, duration: number, data: {
            editor: string,
            project: string,
            language: string
        }
    }) {
        
        super({ timestamp, duration, data });
    }
}