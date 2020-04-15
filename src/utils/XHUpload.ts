import {on} from './events';

export type UploadState = 'idle' |
    'paused' |
    'running' |
    'cancelled' |
    'errored' |
    'timeout' |
    'finished';

export class XHUploadEvent extends Event {
    public readonly state: UploadState;

    constructor(state: UploadState) {
        super('update');
        this.state = state;
    }
}

export class XHUpload extends EventTarget {

    public readonly size: number;
    public state: UploadState = 'idle';

    // Amount of bytes transferred
    public transferred = 0;

    // File and url
    private readonly file: File;
    private readonly url: string;

    // Current request instance, byte-offset and if paused
    private xhr: XMLHttpRequest;

    constructor(url: string, file: File) {
        super();
        this.file = file;
        this.url = url;
        this.size = file.size;
        this.xhr = this.start();
    }

    public pause(): void {
        if (this.state !== 'running') {
            throw new Error('Cannot pause upload if not started.');
        }

        this.xhr.abort();
    }

    public resume(): void {
        if (this.state !== 'paused') {
            throw new Error('Upload not paused.');
        }

        this.start();
    }

    private emitEvent(): void {
        this.dispatchEvent(new XHUploadEvent(
            this.state
        ));
    }

    private start(): XMLHttpRequest {
        const {file, url} = this;
        const xhr = this.xhr = new XMLHttpRequest();

        // Track upload progress
        let lastLoad = 0;
        on(xhr.upload, [
            'loadstart',
            'progress',
            'abort',
            'error',
            'load',
            'timeout'
        ], (e: ProgressEvent) => {

            switch (e.type) {
                case 'progress': {
                    this.transferred += (e.loaded - lastLoad);
                    lastLoad = e.loaded;
                    break;
                }
                case 'timeout': {
                    this.state = 'timeout';
                    break;
                }
                case 'error': {
                    this.state = 'errored';
                    break;
                }
                case 'abort': {
                    this.state = 'paused';
                    break;
                }
                case 'loadstart': {
                    this.state = 'running';
                    break;
                }
                case 'load': {
                    this.state = 'finished';
                    break;
                }
            }

            this.emitEvent();
        });

        // Transfer bytes
        xhr.open('POST', url, true);
        xhr.send(file.slice(this.transferred, file.size, file.type));
        return xhr;
    }
}