/**
 * Message definitions for the Android TV Remote protocol v2.
 *
 * Field numbers follow polo.proto (pairing, port 6467) and remotemessage.proto (remote, port 6466)
 * as published by tronikos/androidtvremote2 (Apache-2.0) and louis49/androidtv-remote (MIT).
 */
import { MessageWriter, decodeMessage, getBytes, getMessage, getNumber, getString } from './protobuf';

// ---------------------------------------------------------------------------------------------
// Pairing (polo.wire.protobuf.OuterMessage)
// ---------------------------------------------------------------------------------------------

/** OuterMessage.Status */
export const PairingStatus = {
    OK: 200,
    ERROR: 400,
    BAD_CONFIGURATION: 401,
    BAD_SECRET: 402,
} as const;

const PROTOCOL_VERSION = 2;
const ROLE_TYPE_INPUT = 1;
const ENCODING_TYPE_HEXADECIMAL = 3;
const SYMBOL_LENGTH = 6;

/** Fields of OuterMessage that are relevant for the client. */
const Outer = {
    protocolVersion: 1,
    status: 2,
    pairingRequest: 10,
    pairingRequestAck: 11,
    options: 20,
    configuration: 30,
    configurationAck: 31,
    secret: 40,
    secretAck: 41,
} as const;

/** Kind of a received pairing message. */
export type PairingMessageKind = 'pairingRequestAck' | 'options' | 'configurationAck' | 'secretAck' | 'unknown';

/** Parsed pairing message. */
export interface PairingMessage {
    /** OuterMessage status code */
    status: number;
    /** Message type */
    kind: PairingMessageKind;
}

function outer(): MessageWriter {
    return new MessageWriter().uint(Outer.protocolVersion, PROTOCOL_VERSION).uint(Outer.status, PairingStatus.OK);
}

function encoding(): MessageWriter {
    return new MessageWriter().uint(1, ENCODING_TYPE_HEXADECIMAL).uint(2, SYMBOL_LENGTH);
}

/**
 * PairingRequest - first message of the pairing handshake.
 *
 * @param clientName - Name shown on the TV
 */
export function encodePairingRequest(clientName: string): Buffer {
    return outer()
        .message(Outer.pairingRequest, new MessageWriter().string(1, 'atvremote').string(2, clientName))
        .finish();
}

/** Options - answer to PairingRequestAck: we are the input side, 6-digit hex code. */
export function encodePairingOptions(): Buffer {
    return outer().message(Outer.options, new MessageWriter().message(1, encoding()).uint(3, ROLE_TYPE_INPUT)).finish();
}

/** Configuration - answer to Options. */
export function encodePairingConfiguration(): Buffer {
    return outer()
        .message(Outer.configuration, new MessageWriter().message(1, encoding()).uint(2, ROLE_TYPE_INPUT))
        .finish();
}

/**
 * Secret - final pairing message.
 *
 * @param secret - SHA-256 hash computed from both certificates and the PIN
 */
export function encodePairingSecret(secret: Buffer): Buffer {
    return outer().message(Outer.secret, new MessageWriter().bytes(1, secret)).finish();
}

/**
 * Parses a pairing message.
 *
 * @param raw - Frame payload
 */
export function decodePairingMessage(raw: Buffer): PairingMessage {
    const msg = decodeMessage(raw);
    const status = getNumber(msg, Outer.status) ?? 0;
    let kind: PairingMessageKind = 'unknown';
    if (msg.has(Outer.pairingRequestAck)) {
        kind = 'pairingRequestAck';
    } else if (msg.has(Outer.options)) {
        kind = 'options';
    } else if (msg.has(Outer.configurationAck)) {
        kind = 'configurationAck';
    } else if (msg.has(Outer.secretAck)) {
        kind = 'secretAck';
    }
    return { status, kind };
}

// ---------------------------------------------------------------------------------------------
// Remote (remote.RemoteMessage)
// ---------------------------------------------------------------------------------------------

/** Feature bit mask negotiated in RemoteConfigure / RemoteSetActive. */
export const Feature = {
    PING: 1 << 0,
    KEY: 1 << 1,
    IME: 1 << 2,
    VOICE: 1 << 3,
    POWER: 1 << 5,
    VOLUME: 1 << 6,
    APP_LINK: 1 << 9,
} as const;

/** RemoteDirection */
export const KeyDirection = {
    START_LONG: 1,
    END_LONG: 2,
    SHORT: 3,
} as const;

/** Key press direction value. */
export type KeyDirectionValue = (typeof KeyDirection)[keyof typeof KeyDirection];

const Remote = {
    configure: 1,
    setActive: 2,
    error: 3,
    pingRequest: 8,
    pingResponse: 9,
    keyInject: 10,
    imeKeyInject: 20,
    imeBatchEdit: 21,
    start: 40,
    setVolumeLevel: 50,
    appLinkLaunchRequest: 90,
} as const;

/** Device info reported by the TV in RemoteConfigure. */
export interface RemoteDeviceInfo {
    /** Device model */
    model?: string;
    /** Manufacturer */
    vendor?: string;
    /** Version of the Android TV Remote Service */
    appVersion?: string;
}

/** Volume state reported by the TV. */
export interface VolumeInfo {
    /** Current volume */
    level: number;
    /** Maximum volume */
    max: number;
    /** Mute state */
    muted: boolean;
}

/** Union of all remote messages the client reacts to. */
export type RemoteInbound =
    | { type: 'configure'; features: number; deviceInfo: RemoteDeviceInfo }
    | { type: 'setActive' }
    | { type: 'pingRequest'; val1: number }
    | { type: 'imeKeyInject'; appPackage: string | undefined }
    | { type: 'imeBatchEdit'; imeCounter: number; fieldCounter: number }
    | { type: 'start'; started: boolean }
    | { type: 'volume'; volume: VolumeInfo }
    | { type: 'error' }
    | { type: 'unknown'; fields: number[] };

/**
 * Parses a remote message.
 *
 * @param raw - Frame payload
 */
export function decodeRemoteMessage(raw: Buffer): RemoteInbound {
    const msg = decodeMessage(raw);
    const configure = getMessage(msg, Remote.configure);
    if (configure) {
        const info = getMessage(configure, 2);
        return {
            type: 'configure',
            features: getNumber(configure, 1) ?? 0,
            deviceInfo: info
                ? { model: getString(info, 1), vendor: getString(info, 2), appVersion: getString(info, 6) }
                : {},
        };
    }
    if (msg.has(Remote.setActive)) {
        return { type: 'setActive' };
    }
    const ping = getMessage(msg, Remote.pingRequest);
    if (ping) {
        return { type: 'pingRequest', val1: getNumber(ping, 1) ?? 0 };
    }
    const ime = getMessage(msg, Remote.imeKeyInject);
    if (ime) {
        const appInfo = getMessage(ime, 1);
        return { type: 'imeKeyInject', appPackage: appInfo ? getString(appInfo, 12) : undefined };
    }
    const batch = getMessage(msg, Remote.imeBatchEdit);
    if (batch) {
        return {
            type: 'imeBatchEdit',
            imeCounter: getNumber(batch, 1) ?? 0,
            fieldCounter: getNumber(batch, 2) ?? 0,
        };
    }
    const start = getMessage(msg, Remote.start);
    if (start) {
        return { type: 'start', started: (getNumber(start, 1) ?? 0) !== 0 };
    }
    const vol = getMessage(msg, Remote.setVolumeLevel);
    if (vol) {
        return {
            type: 'volume',
            volume: {
                max: getNumber(vol, 6) ?? 0,
                level: getNumber(vol, 7) ?? 0,
                muted: (getNumber(vol, 8) ?? 0) !== 0,
            },
        };
    }
    if (getBytes(msg, Remote.error)) {
        return { type: 'error' };
    }
    return { type: 'unknown', fields: [...msg.keys()] };
}

/**
 * RemoteConfigure answer with our active features and a client device info.
 *
 * @param features - Feature bit mask
 */
export function encodeRemoteConfigure(features: number): Buffer {
    const deviceInfo = new MessageWriter().uint(3, 1).string(4, '1').string(5, 'atvremote').string(6, '1.0.0');
    return new MessageWriter()
        .message(Remote.configure, new MessageWriter().uint(1, features).message(2, deviceInfo))
        .finish();
}

/**
 * RemoteSetActive answer.
 *
 * @param features - Feature bit mask
 */
export function encodeRemoteSetActive(features: number): Buffer {
    return new MessageWriter().message(Remote.setActive, new MessageWriter().uint(1, features)).finish();
}

/**
 * RemotePingResponse.
 *
 * @param val1 - Value from the ping request
 */
export function encodePingResponse(val1: number): Buffer {
    return new MessageWriter().message(Remote.pingResponse, new MessageWriter().uint(1, val1)).finish();
}

/**
 * RemoteKeyInject.
 *
 * @param keyCode - Android key code
 * @param direction - SHORT, START_LONG or END_LONG
 */
export function encodeKeyInject(keyCode: number, direction: KeyDirectionValue = KeyDirection.SHORT): Buffer {
    return new MessageWriter()
        .message(Remote.keyInject, new MessageWriter().uint(1, keyCode).uint(2, direction))
        .finish();
}

/**
 * RemoteAppLinkLaunchRequest.
 *
 * @param appLink - Deep link or market://launch?id=<package>
 */
export function encodeAppLink(appLink: string): Buffer {
    return new MessageWriter().message(Remote.appLinkLaunchRequest, new MessageWriter().string(1, appLink)).finish();
}

/**
 * RemoteImeBatchEdit to insert text into the focused text field.
 *
 * @param text - Text to send (non-empty)
 * @param imeCounter - Counter from the last imeBatchEdit received
 * @param fieldCounter - Field counter from the last imeBatchEdit received
 */
export function encodeImeText(text: string, imeCounter: number, fieldCounter: number): Buffer {
    const pos = Math.max(0, text.length - 1);
    const imeObject = new MessageWriter().uint(1, pos).uint(2, pos).string(3, text);
    const editInfo = new MessageWriter().uint(1, 1).message(2, imeObject);
    return new MessageWriter()
        .message(
            Remote.imeBatchEdit,
            new MessageWriter().uint(1, imeCounter).uint(2, fieldCounter).message(3, editInfo),
        )
        .finish();
}
