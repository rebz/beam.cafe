import {action, observable} from 'mobx';
import {SwitchState}        from '../../app/components/Switch';
import {localStorageUtils}  from '../../utils/local-storage-utils';
import {socket}             from './Socket';

type ClientSide = {
    autoPause: boolean;
    theme: 'light' | 'dark';
};

type ServerSide = {
    strictSession: SwitchState;
};

type AllSettings = ClientSide & ServerSide;

class Settings {

    public static readonly SERVER_SIDE: Array<keyof ServerSide> = [
        'strictSession'
    ];

    public static readonly DEFAULT_SETTINGS: AllSettings = {
        strictSession: false,
        autoPause: false,
        theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    };

    @observable private readonly settings: AllSettings;

    constructor() {
        this.settings = {...Settings.DEFAULT_SETTINGS};
        const saved = localStorageUtils.getJSON('settings');

        if (saved !== null) {
            Object.assign(this.settings, saved);
        }
    }

    private syncLocal(): void {
        localStorageUtils.setJSON('settings', this.settings);
    }

    @action
    public set<K extends keyof AllSettings>(key: K, value: AllSettings[K]): void {

        /**
         * TS is so god damn weird here, for god sake if I want to check
         * if an array contains a string let me PLEASE ALSO CHECK OTHER VALUES
         * for which .includes was made.
         */
        const maybeServerSide = key as unknown as keyof ServerSide;

        if (Settings.SERVER_SIDE.includes(maybeServerSide)) {

            // TODO: Mixing booleans and string is definitely not best practice, change that later!
            this.settings[maybeServerSide] = 'intermediate';

            socket.request('settings', {
                key, value
            }).then(() => {
                this.settings[key] = value;
            }).catch(() => {
                this.settings[key] = Settings.DEFAULT_SETTINGS[key];
            });
        } else {
            this.settings[key] = value;
            this.syncLocal();
        }
    }

    public get<K extends keyof AllSettings>(key: K): AllSettings[K] {
        return this.settings[key];
    }
}

export const settings = new Settings();
