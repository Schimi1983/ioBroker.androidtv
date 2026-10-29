// This file extends the AdapterConfig type from "@iobroker/types"

/** One configured TV (row of the device table). */
interface AndroidTvDeviceConfig {
    enabled: boolean;
    name: string;
    host: string;
    /** Request the IME feature (current app, text input). */
    enableIme: boolean;
    /** Connection type; missing = "remote" (configs of 0.0.1). */
    connection?: 'remote' | 'remote_adb' | 'adb';
    /** ADB port for network debugging, default 5555. */
    adbPort?: number;
    /** MAC address for Wake-on-LAN; empty = reported by the device. */
    wolMac?: string;
    /** Extra broadcast address for Wake-on-LAN (e.g. directed broadcast of another subnet). */
    wolBroadcast?: string;
}

/** One app favorite (row of the app table). */
interface AndroidTvAppConfig {
    name: string;
    /** Deep link (https://…, market://…) or package name. */
    link: string;
}

declare global {
    namespace ioBroker {
        interface AdapterConfig {
            devices: AndroidTvDeviceConfig[];
            apps: AndroidTvAppConfig[];
            /** Name shown on the TV during pairing and used as certificate CN. */
            clientName: string;
            /** Upper bound of the reconnect backoff in seconds. */
            reconnectMax: number;
            /** ADB status poll interval in seconds while a device is on. */
            adbPollInterval?: number;
            /** Legacy (0.0.1): client certificate, migrated to file storage. */
            clientCert?: string;
            /** Legacy (0.0.1): client private key, migrated to file storage. */
            clientKey?: string;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
