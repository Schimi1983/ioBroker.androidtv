// Minimal protobuf wire-format codec.
//
// @KI_HINWEIS: Bewusst kein protobufjs. Das Protokoll nutzt nur ~10 flache Nachrichten mit
// varint-, string-, bytes- und eingebetteten Feldern. Ein eigener Codec von ~150 Zeilen spart
// eine Laufzeit-Abhängigkeit inkl. Reflection/Codegen und hält den Adapter schlank.

/** Protobuf wire types used by the Android TV protocols. */
export enum WireType {
    Varint = 0,
    Fixed64 = 1,
    LengthDelimited = 2,
    Fixed32 = 5,
}

/** A decoded field value: number for varints/fixed, Buffer for length-delimited. */
export type FieldValue = number | Buffer;

/** Decoded message: field number → all occurrences in wire order. */
export type DecodedMessage = Map<number, FieldValue[]>;

/**
 * Encodes an unsigned integer (up to 2^53) as protobuf varint.
 *
 * @param value - Non-negative integer
 */
export function encodeVarint(value: number): Buffer {
    if (!Number.isInteger(value) || value < 0) {
        throw new RangeError(`Varint must be a non-negative integer, got ${value}`);
    }
    const bytes: number[] = [];
    let v = value;
    while (v > 0x7f) {
        bytes.push((v % 0x80) | 0x80);
        v = Math.floor(v / 0x80);
    }
    bytes.push(v);
    return Buffer.from(bytes);
}

/**
 * Decodes a varint at the given offset.
 *
 * @param buf - Source buffer
 * @param offset - Start offset
 * @returns value and offset after the varint, or null if the buffer ends inside the varint
 */
export function decodeVarint(buf: Buffer, offset: number): { value: number; next: number } | null {
    let result = 0;
    let multiplier = 1;
    let pos = offset;
    for (let i = 0; i < 10; i++) {
        if (pos >= buf.length) {
            return null;
        }
        const byte = buf[pos++];
        result += (byte & 0x7f) * multiplier;
        if ((byte & 0x80) === 0) {
            return { value: result, next: pos };
        }
        multiplier *= 0x80;
    }
    throw new Error('Varint too long');
}

/** Fluent builder for a protobuf message. Fields with undefined values are skipped. */
export class MessageWriter {
    private readonly parts: Buffer[] = [];

    private tag(field: number, wireType: WireType): void {
        this.parts.push(encodeVarint(field * 8 + wireType));
    }

    /**
     * Writes an unsigned varint field (uint32, int32 ≥ 0, enum).
     *
     * @param field - Field number
     * @param value - Value; undefined skips the field
     */
    public uint(field: number, value: number | undefined): this {
        if (value !== undefined) {
            this.tag(field, WireType.Varint);
            this.parts.push(encodeVarint(value));
        }
        return this;
    }

    /**
     * Writes a bool field.
     *
     * @param field - Field number
     * @param value - Value; undefined skips the field
     */
    public bool(field: number, value: boolean | undefined): this {
        return this.uint(field, value === undefined ? undefined : value ? 1 : 0);
    }

    /**
     * Writes a length-delimited bytes field.
     *
     * @param field - Field number
     * @param value - Value; undefined skips the field
     */
    public bytes(field: number, value: Buffer | undefined): this {
        if (value !== undefined) {
            this.tag(field, WireType.LengthDelimited);
            this.parts.push(encodeVarint(value.length), value);
        }
        return this;
    }

    /**
     * Writes a UTF-8 string field.
     *
     * @param field - Field number
     * @param value - Value; undefined skips the field
     */
    public string(field: number, value: string | undefined): this {
        return this.bytes(field, value === undefined ? undefined : Buffer.from(value, 'utf8'));
    }

    /**
     * Writes an embedded message field. An empty sub-message is still written (presence matters).
     *
     * @param field - Field number
     * @param value - Sub-message; undefined skips the field
     */
    public message(field: number, value: MessageWriter | undefined): this {
        return this.bytes(field, value?.finish());
    }

    /** Returns the serialized message. */
    public finish(): Buffer {
        return Buffer.concat(this.parts);
    }
}

/**
 * Decodes one protobuf message into a field map.
 *
 * @param buf - Serialized message
 */
export function decodeMessage(buf: Buffer): DecodedMessage {
    const fields: DecodedMessage = new Map();
    let pos = 0;
    while (pos < buf.length) {
        const tag = decodeVarint(buf, pos);
        if (!tag) {
            throw new Error('Truncated tag');
        }
        pos = tag.next;
        const field = Math.floor(tag.value / 8);
        const wireType = tag.value % 8;
        let value: FieldValue;
        switch (wireType) {
            case WireType.Varint: {
                const v = decodeVarint(buf, pos);
                if (!v) {
                    throw new Error('Truncated varint');
                }
                value = v.value;
                pos = v.next;
                break;
            }
            case WireType.LengthDelimited: {
                const len = decodeVarint(buf, pos);
                if (!len || len.next + len.value > buf.length) {
                    throw new Error('Truncated length-delimited field');
                }
                value = buf.subarray(len.next, len.next + len.value);
                pos = len.next + len.value;
                break;
            }
            case WireType.Fixed32:
                if (pos + 4 > buf.length) {
                    throw new Error('Truncated fixed32');
                }
                value = buf.readUInt32LE(pos);
                pos += 4;
                break;
            case WireType.Fixed64:
                if (pos + 8 > buf.length) {
                    throw new Error('Truncated fixed64');
                }
                value = Number(buf.readBigUInt64LE(pos));
                pos += 8;
                break;
            default:
                throw new Error(`Unsupported wire type ${wireType}`);
        }
        const list = fields.get(field);
        if (list) {
            list.push(value);
        } else {
            fields.set(field, [value]);
        }
    }
    return fields;
}

/**
 * Returns the last numeric value of a field (protobuf "last one wins").
 *
 * @param msg - Decoded message
 * @param field - Field number
 */
export function getNumber(msg: DecodedMessage, field: number): number | undefined {
    const v = msg.get(field)?.at(-1);
    return typeof v === 'number' ? v : undefined;
}

/**
 * Returns the last length-delimited value of a field as Buffer.
 *
 * @param msg - Decoded message
 * @param field - Field number
 */
export function getBytes(msg: DecodedMessage, field: number): Buffer | undefined {
    const v = msg.get(field)?.at(-1);
    return Buffer.isBuffer(v) ? v : undefined;
}

/**
 * Returns a string field.
 *
 * @param msg - Decoded message
 * @param field - Field number
 */
export function getString(msg: DecodedMessage, field: number): string | undefined {
    return getBytes(msg, field)?.toString('utf8');
}

/**
 * Returns an embedded message field, decoded.
 *
 * @param msg - Decoded message
 * @param field - Field number
 */
export function getMessage(msg: DecodedMessage, field: number): DecodedMessage | undefined {
    const b = getBytes(msg, field);
    return b ? decodeMessage(b) : undefined;
}

/**
 * Splits a byte stream into varint-length-prefixed frames, as used by both Android TV protocols.
 * Handles partial frames and multiple frames per chunk.
 */
export class FrameDecoder {
    private buffer: Buffer = Buffer.alloc(0);

    /** Maximum accepted frame size; protects against garbage length prefixes. */
    public static readonly MAX_FRAME = 1024 * 1024;

    /**
     * Feeds data and returns all complete frames.
     *
     * @param chunk - Received bytes
     */
    public push(chunk: Buffer): Buffer[] {
        this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
        const frames: Buffer[] = [];
        while (this.buffer.length) {
            const len = decodeVarint(this.buffer, 0);
            if (!len) {
                break;
            }
            if (len.value > FrameDecoder.MAX_FRAME) {
                this.buffer = Buffer.alloc(0);
                throw new Error(`Frame too large: ${len.value} bytes`);
            }
            const end = len.next + len.value;
            if (this.buffer.length < end) {
                break;
            }
            frames.push(this.buffer.subarray(len.next, end));
            this.buffer = this.buffer.subarray(end);
        }
        return frames;
    }

    /** Clears buffered data, e.g. after reconnect. */
    public reset(): void {
        this.buffer = Buffer.alloc(0);
    }
}

/**
 * Prefixes a serialized message with its varint length.
 *
 * @param payload - Serialized message
 */
export function frame(payload: Buffer): Buffer {
    return Buffer.concat([encodeVarint(payload.length), payload]);
}
