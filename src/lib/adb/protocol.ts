// ADB transport protocol (classic, unencrypted TCP – "adb tcpip 5555" / "Network debugging").
//
// @KI_HINWEIS: Eigene Implementierung statt @yume-chan/adb (Tango). Tango benötigt einen WHATWG-Stream-Unterbau
// aus mehreren Paketen und das Node-Credential-Paket ist nur als Beta verfügbar. Für die hier benötigten Funktionen
// (Verbindung, RSA-Auth, Shell-Kommandos) reichen sieben Nachrichtentypen; spart Abhängigkeiten und RAM.
// Referenz: AOSP packages/modules/adb/protocol.txt

/** ADB command constants (little-endian ASCII). */
export const AdbCommand = {
    SYNC: 0x434e5953,
    CNXN: 0x4e584e43,
    AUTH: 0x48545541,
    OPEN: 0x4e45504f,
    OKAY: 0x59414b4f,
    CLSE: 0x45534c43,
    WRTE: 0x45545257,
} as const;

/** AUTH packet sub-types (arg0). */
export const AdbAuthType = {
    TOKEN: 1,
    SIGNATURE: 2,
    RSAPUBLICKEY: 3,
} as const;

/** Protocol version sent in CNXN (with checksum-free data). */
export const ADB_VERSION = 0x01000001;
/** Maximum payload size announced in CNXN. */
export const ADB_MAX_PAYLOAD = 256 * 1024;
/** Header size in bytes. */
export const ADB_HEADER_LENGTH = 24;

/** One ADB packet. */
export interface AdbPacket {
    /** ADB command (e.g. CNXN, OPEN) */
    command: number;
    /** First argument (meaning depends on command) */
    arg0: number;
    /** Second argument (meaning depends on command) */
    arg1: number;
    /** Packet payload */
    payload: Buffer;
}

/**
 * Sum of all payload bytes, as used by protocol versions before 0x01000001.
 *
 * @param data - Payload
 */
function checksum(data: Buffer): number {
    let sum = 0;
    for (const byte of data) {
        sum = (sum + byte) >>> 0;
    }
    return sum;
}

/**
 * Serializes a packet (24 byte header + payload).
 *
 * @param packet - Packet to send
 */
export function encodeAdbPacket(packet: AdbPacket): Buffer {
    const header = Buffer.alloc(ADB_HEADER_LENGTH);
    header.writeUInt32LE(packet.command >>> 0, 0);
    header.writeUInt32LE(packet.arg0 >>> 0, 4);
    header.writeUInt32LE(packet.arg1 >>> 0, 8);
    header.writeUInt32LE(packet.payload.length, 12);
    header.writeUInt32LE(checksum(packet.payload), 16);
    header.writeUInt32LE((packet.command ^ 0xffffffff) >>> 0, 20);
    return Buffer.concat([header, packet.payload]);
}

/** Incremental decoder for a stream of ADB packets. */
export class AdbPacketDecoder {
    private buffer: Buffer = Buffer.alloc(0);

    /**
     * Feeds received bytes and returns all complete packets.
     *
     * @param chunk - Received data
     */
    public push(chunk: Buffer): AdbPacket[] {
        this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
        const packets: AdbPacket[] = [];
        while (this.buffer.length >= ADB_HEADER_LENGTH) {
            const command = this.buffer.readUInt32LE(0);
            const magic = this.buffer.readUInt32LE(20);
            if ((command ^ 0xffffffff) >>> 0 !== magic) {
                this.buffer = Buffer.alloc(0);
                throw new Error('Invalid ADB packet header (magic mismatch)');
            }
            const length = this.buffer.readUInt32LE(12);
            if (length > ADB_MAX_PAYLOAD * 4) {
                this.buffer = Buffer.alloc(0);
                throw new Error(`ADB payload too large: ${length}`);
            }
            if (this.buffer.length < ADB_HEADER_LENGTH + length) {
                break;
            }
            packets.push({
                command,
                arg0: this.buffer.readUInt32LE(4),
                arg1: this.buffer.readUInt32LE(8),
                payload: Buffer.from(this.buffer.subarray(ADB_HEADER_LENGTH, ADB_HEADER_LENGTH + length)),
            });
            this.buffer = this.buffer.subarray(ADB_HEADER_LENGTH + length);
        }
        return packets;
    }

    /** Clears buffered data. */
    public reset(): void {
        this.buffer = Buffer.alloc(0);
    }
}

/**
 * Human readable command name for logs.
 *
 * @param command - Command constant
 */
export function commandName(command: number): string {
    const entry = Object.entries(AdbCommand).find(([, v]) => v === command);
    return entry ? entry[0] : `0x${command.toString(16)}`;
}
