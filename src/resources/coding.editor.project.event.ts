import Event from './event';

/**
 * @description Interface for events of the type coding.editor.project
 */

export default interface ProjectEvent extends Event{
    data: {
        editor: string;
        project: string;
        language: string;
    };
}