/** Bounded mDNS/DNS-SD discovery for Android TV Remote v2 devices. */
import { createSocket as createDgramSocket } from 'node:dgram';
import { isIP } from 'node:net';

export const ANDROID_TV_REMOTE_SERVICE = '_androidtvremote2._tcp.local.';
const MDNS_PORT = 5353;
const MDNS_IPV4 = '224.0.0.251';
const MDNS_IPV6 = 'ff02::fb';
const MAX_SERVICES = 128;
const MAX_HOSTS = 256;
const MAX_ADDRESSES_PER_HOST = 16;
const MAX_TXT_ENTRIES = 64;
const MAX_TXT_ENTRIES_PER_SERVICE = 64;
const MAX_TXT_BYTES_PER_SERVICE = 4096;
const MAX_DNS_LABELS = 127;
const PTR = 12;
const TXT = 16;
const SRV = 33;
const A = 1;
const AAAA = 28;

/** A validated Android TV Remote v2 service discovered on the local network. */
export interface DiscoveredAndroidTv {
    /** Instance name advertised by the DNS-SD PTR record. */
    serviceName: string;
    /** Host target from SRV, when advertised. */
    hostname?: string;
    /** Other hostnames observed for the same deduplicated device. */
    alternateHostnames?: string[];
    /** First discovered IPv4/IPv6 address, when available. */
    address?: string;
    /** All discovered addresses for the SRV host. */
    addresses: string[];
    /** Remote v2 control port from SRV, when advertised. */
    port?: number;
    /** Safely parsed key/value metadata advertised by DNS-SD TXT. */
    txtMetadata: Record<string, string>;
    /** Friendly name advertised by TXT, when present. */
    deviceName?: string;
    /** Model advertised by TXT, when present. */
    model?: string;
    /** Manufacturer advertised by TXT, when present. */
    manufacturer?: string;
    /** Syntactically valid Bluetooth address from the standard `bt` TXT field. */
    macAddress?: string;
    /** Conservative protocol suggestion based only on the verified service type. */
    connectionTypeSuggestion: 'remote-v2';
}

/** A datagram socket surface used by the scanner and deterministic tests. */
export interface DiscoverySocket {
    /** Registers a message or error listener. */
    on(event: 'message', listener: (message: Buffer) => void): this;
    /** Registers an error listener. */
    on(event: 'error', listener: (error: Error) => void): this;
    /** Removes a previously registered listener. */
    off(event: 'message' | 'error', listener: (...args: any[]) => void): this;
    /** Binds the socket to the mDNS port. */
    bind(port: number, address?: string, callback?: () => void): this;
    /** Joins an mDNS multicast group. */
    addMembership(multicastAddress: string): void;
    /** Sends a DNS-SD query. */
    send(message: Buffer, port: number, address: string, callback?: (error: Error | null) => void): void;
    /** Closes the socket. */
    close(): this;
}

/** Scan configuration and resource/cancellation injection points. */
export interface DiscoveryOptions {
    /** Total duration of the multicast scan, in milliseconds. Defaults to 2 seconds. */
    timeoutMs?: number;
    /** Socket factory override. The scanner closes every socket it creates. */
    createSocket?: (family: 'udp4' | 'udp6') => DiscoverySocket;
    /** Timer overrides for deterministic tests and cancellation. */
    setTimeout?: (callback: () => void, delayMs: number) => unknown;
    /** Clear a timer returned by the injected timer factory. */
    clearTimeout?: (timer: unknown) => void;
    /** Optional signal for immediate cancellation before the scan timeout. */
    signal?: AbortSignal;
    /** Reports a socket setup or network error for one address family. */
    onError?: (family: 'udp4' | 'udp6', error: Error) => void;
}

interface ResourceRecord {
    name: string;
    type: number;
    data: Buffer;
    dataOffset: number;
}

interface ServiceInfo {
    serviceName: string;
}

function normalizeHost(host: string): string {
    let value = host.trim().toLowerCase();
    if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1);
    }
    value = value.replace(/\.$/, '');
    if (isIP(value) === 6) {
        try {
            const canonical = new URL(`http://[${value}]/`).hostname;
            return canonical.slice(1, -1);
        } catch {
            // Preserve a comparable value if a platform URL parser rejects an unusual IPv6 literal.
        }
    }
    return value;
}

function isLinkLocalIpv6(address: string): boolean {
    const normalized = normalizeHost(address);
    if (isIP(normalized) !== 6) {
        return false;
    }
    const firstGroup = normalized.split(':', 1)[0];
    return !!firstGroup && (Number.parseInt(firstGroup, 16) & 0xffc0) === 0xfe80;
}

/**
 * Whether a host selected from untrusted DNS-SD data is safe to store as a device host.
 *
 * @param host - Candidate hostname or IP address.
 */
export function isUsableDiscoveredHost(host: string): boolean {
    const candidate = host.trim().replace(/\.$/, '');
    if (isIP(candidate)) {
        return !isLinkLocalIpv6(candidate);
    }
    if (candidate.length > 253 || !candidate.length) {
        return false;
    }
    return candidate
        .split('.')
        .every(label => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label));
}

/**
 * Prefer IPv4 where available, then IPv6, then a validated DNS hostname.
 *
 * @param device - Discovered service to select a usable connection host from.
 */
export function getDiscoveredDeviceHost(device: DiscoveredAndroidTv): string | undefined {
    const addresses = [...new Set([device.address, ...device.addresses].filter((value): value is string => !!value))];
    const ipv4 = addresses.find(address => isIP(address) === 4);
    const ipv6 = addresses.find(address => isIP(address) === 6 && isUsableDiscoveredHost(address));
    const hostname = [device.hostname, ...(device.alternateHostnames ?? [])].find((candidate): candidate is string =>
        Boolean(candidate && isUsableDiscoveredHost(candidate)),
    );
    const host = ipv4 ?? ipv6 ?? hostname;
    if (!host || !isUsableDiscoveredHost(host)) {
        return undefined;
    }
    return host.replace(/\.$/, '');
}

function hostAliases(device: DiscoveredAndroidTv): string[] {
    return [
        ...new Set(
            [device.hostname, ...(device.alternateHostnames ?? []), device.address, ...device.addresses]
                .filter((host): host is string => Boolean(host))
                .map(normalizeHost)
                .filter(Boolean),
        ),
    ];
}

function deduplicationAliases(device: DiscoveredAndroidTv): string[] {
    return [...hostAliases(device), `service:${normalizeHost(device.serviceName)}`];
}

function mergeDevices(target: DiscoveredAndroidTv, source: DiscoveredAndroidTv): DiscoveredAndroidTv {
    const addresses = [
        ...new Set(
            [target.address, ...target.addresses, source.address, ...source.addresses]
                .filter((value): value is string => Boolean(value))
                .map(normalizeHost),
        ),
    ];
    const address = target.address ?? source.address ?? addresses[0];
    const hostname = target.hostname ?? source.hostname;
    const primaryHostname = hostname ? normalizeHost(hostname) : undefined;
    const alternateHostnames = [
        ...new Set(
            [
                target.hostname,
                ...(target.alternateHostnames ?? []),
                source.hostname,
                ...(source.alternateHostnames ?? []),
            ]
                .filter((host): host is string => Boolean(host))
                .map(normalizeHost),
        ),
    ].filter(host => host !== primaryHostname);
    const txtMetadata = { ...source.txtMetadata, ...target.txtMetadata };
    return {
        ...source,
        ...target,
        hostname,
        ...(alternateHostnames.length ? { alternateHostnames } : {}),
        address,
        addresses,
        port: target.port ?? source.port,
        txtMetadata,
        deviceName: target.deviceName ?? source.deviceName,
        model: target.model ?? source.model,
        manufacturer: target.manufacturer ?? source.manufacturer,
        macAddress: target.macAddress ?? source.macAddress,
    };
}

/**
 * Merge duplicate service/hostname/address results while retaining their useful metadata.
 *
 * @param devices - Discovered services to merge.
 */
export function deduplicateAndroidTvs(devices: DiscoveredAndroidTv[]): DiscoveredAndroidTv[] {
    const unique: DiscoveredAndroidTv[] = [];
    const aliasesByDevice: Set<string>[] = [];
    for (const device of devices) {
        const deviceAliases = new Set(deduplicationAliases(device));
        const matches: number[] = [];
        for (let index = 0; index < aliasesByDevice.length; index++) {
            if ([...deviceAliases].some(alias => aliasesByDevice[index].has(alias))) {
                matches.push(index);
            }
        }
        if (!matches.length) {
            unique.push(device);
            aliasesByDevice.push(deviceAliases);
            continue;
        }
        const primary = matches[0];
        unique[primary] = mergeDevices(unique[primary], device);
        for (const alias of deviceAliases) {
            aliasesByDevice[primary].add(alias);
        }
        for (const index of matches.slice(1).reverse()) {
            unique[primary] = mergeDevices(unique[primary], unique[index]);
            for (const alias of aliasesByDevice[index]) {
                aliasesByDevice[primary].add(alias);
            }
            unique.splice(index, 1);
            aliasesByDevice.splice(index, 1);
        }
    }
    return unique;
}

/**
 * Exclude discoveries matching any configured host name or IP address.
 *
 * @param devices - Services to filter.
 * @param configuredHosts - Host names and IP addresses already configured in the adapter.
 */
export function excludeConfiguredAndroidTvs(
    devices: DiscoveredAndroidTv[],
    configuredHosts: Iterable<string>,
): DiscoveredAndroidTv[] {
    const configured = new Set([...configuredHosts].map(normalizeHost).filter(Boolean));
    return devices.filter(device => !hostAliases(device).some(alias => configured.has(alias)));
}

function readName(packet: Buffer, initialOffset: number): { name: string; offset: number } {
    const labels: string[] = [];
    const visited = new Set<number>();
    let offset = initialOffset;
    let nextOffset = -1;
    let wireLength = 0;
    let steps = 0;

    while (offset < packet.length && steps++ < MAX_DNS_LABELS * 2) {
        const length = packet[offset];
        if (length === undefined) {
            throw new Error('Truncated DNS name');
        }
        if ((length & 0xc0) === 0xc0) {
            if (offset + 1 >= packet.length) {
                throw new Error('Truncated DNS compression pointer');
            }
            const pointer = ((length & 0x3f) << 8) | packet[offset + 1];
            if (pointer >= packet.length || visited.has(pointer)) {
                throw new Error('Invalid or cyclic DNS compression pointer');
            }
            visited.add(offset);
            if (nextOffset < 0) {
                nextOffset = offset + 2;
            }
            offset = pointer;
            continue;
        }
        if ((length & 0xc0) !== 0) {
            throw new Error('Invalid DNS label length');
        }
        offset++;
        if (length === 0) {
            return { name: `${labels.join('.')}.`, offset: nextOffset < 0 ? offset : nextOffset };
        }
        if (length > 63 || offset + length > packet.length) {
            throw new Error('Invalid DNS label');
        }
        wireLength += length + 1;
        if (wireLength > 255) {
            throw new Error('DNS name exceeds the protocol limit');
        }
        labels.push(packet.toString('utf8', offset, offset + length));
        offset += length;
    }
    throw new Error('Malformed or cyclic DNS name');
}

function parseRecords(packet: Buffer): ResourceRecord[] {
    if (packet.length < 12) {
        return [];
    }
    const questions = packet.readUInt16BE(4);
    const totalRecords = packet.readUInt16BE(6) + packet.readUInt16BE(8) + packet.readUInt16BE(10);
    let offset = 12;
    try {
        for (let index = 0; index < questions; index++) {
            offset = readName(packet, offset).offset + 4;
            if (offset > packet.length) {
                return [];
            }
        }
    } catch {
        return [];
    }

    const records: ResourceRecord[] = [];
    for (let index = 0; index < totalRecords && offset < packet.length; index++) {
        let parsedName: { name: string; offset: number };
        try {
            parsedName = readName(packet, offset);
        } catch {
            break;
        }
        offset = parsedName.offset;
        if (offset + 10 > packet.length) {
            break;
        }
        const type = packet.readUInt16BE(offset);
        const recordClass = packet.readUInt16BE(offset + 2) & 0x7fff;
        const dataLength = packet.readUInt16BE(offset + 8);
        const dataOffset = offset + 10;
        const end = dataOffset + dataLength;
        if (end > packet.length) {
            break;
        }
        if (recordClass === 1) {
            records.push({
                name: parsedName.name.toLowerCase(),
                type,
                data: packet.subarray(dataOffset, end),
                dataOffset,
            });
        }
        offset = end;
    }
    return records;
}

function parseTxt(data: Buffer): Record<string, string> {
    const result: Record<string, string> = {};
    let entries = 0;
    for (let offset = 0; offset < data.length && entries < MAX_TXT_ENTRIES; entries++) {
        const length = data[offset++];
        if (length === undefined || offset + length > data.length) {
            break;
        }
        const entry = data
            .toString('utf8', offset, offset + length)
            .replace(/\p{Cc}/gu, '')
            .trim();
        offset += length;
        const separator = entry.indexOf('=');
        const key = (separator < 0 ? entry : entry.slice(0, separator)).trim();
        const value =
            separator < 0
                ? ''
                : entry
                      .slice(separator + 1)
                      .trim()
                      .slice(0, 255);
        if (key && key.length <= 64) {
            Object.defineProperty(result, key, {
                value,
                enumerable: true,
                configurable: true,
                writable: true,
            });
        }
    }
    return result;
}

function getTxtValue(metadata: Record<string, string>, ...keys: string[]): string | undefined {
    const wanted = new Set(keys.map(key => key.toLowerCase()));
    return Object.entries(metadata).find(([key, value]) => wanted.has(key.toLowerCase()) && value)?.[1];
}

function decodeAddress(record: ResourceRecord): string | undefined {
    if (record.type === A && record.data.length === 4) {
        return [...record.data].join('.');
    }
    if (record.type !== AAAA || record.data.length !== 16) {
        return undefined;
    }
    const groups: string[] = [];
    for (let index = 0; index < 16; index += 2) {
        groups.push(record.data.readUInt16BE(index).toString(16));
    }
    try {
        return new URL(`http://[${groups.join(':')}]/`).hostname.slice(1, -1);
    } catch {
        return undefined;
    }
}

function parseSrv(packet: Buffer, record: ResourceRecord): { hostname?: string; port?: number } | undefined {
    if (record.data.length < 7) {
        return undefined;
    }
    try {
        const target = readName(packet, record.dataOffset + 6);
        if (target.offset > record.dataOffset + record.data.length) {
            return undefined;
        }
        const hostname = target.name === '.' ? undefined : target.name;
        const port = record.data.readUInt16BE(4);
        return { ...(hostname ? { hostname } : {}), ...(port > 0 ? { port } : {}) };
    } catch {
        return undefined;
    }
}

function parsePtr(packet: Buffer, record: ResourceRecord): string | undefined {
    try {
        const target = readName(packet, record.dataOffset);
        if (target.offset > record.dataOffset + record.data.length || target.name === '.') {
            return undefined;
        }
        return target.name;
    } catch {
        return undefined;
    }
}

function addAddress(map: Map<string, Set<string>>, hostname: string, address: string): void {
    const key = hostname.toLowerCase();
    if (!map.has(key) && map.size >= MAX_HOSTS) {
        return;
    }
    const found = map.get(key) ?? new Set<string>();
    if (found.size < MAX_ADDRESSES_PER_HOST) {
        found.add(address);
    }
    map.set(key, found);
}

interface ServiceMetadata {
    hostname?: string;
    port?: number;
    txtMetadata: Record<string, string>;
    txtEntryCount: number;
    txtByteCount: number;
}

function mergeTxt(metadata: ServiceMetadata, source: Record<string, string>): void {
    for (const [key, value] of Object.entries(source)) {
        const hasPrevious = Object.prototype.hasOwnProperty.call(metadata.txtMetadata, key);
        const previous = hasPrevious ? metadata.txtMetadata[key] : '';
        const entryCount = metadata.txtEntryCount + (hasPrevious ? 0 : 1);
        const keyBytes = Buffer.byteLength(key, 'utf8');
        const previousBytes = hasPrevious ? keyBytes + Buffer.byteLength(previous, 'utf8') : 0;
        const bytes = metadata.txtByteCount - previousBytes + keyBytes + Buffer.byteLength(value, 'utf8');
        if (entryCount > MAX_TXT_ENTRIES_PER_SERVICE || bytes > MAX_TXT_BYTES_PER_SERVICE) {
            continue;
        }
        Object.defineProperty(metadata.txtMetadata, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true,
        });
        metadata.txtEntryCount = entryCount;
        metadata.txtByteCount = bytes;
    }
}

function parseResponse(
    packet: Buffer,
    services: Map<string, ServiceInfo>,
    serviceMetadata: Map<string, ServiceMetadata>,
    addressRecords: Map<string, Set<string>>,
): void {
    const records = parseRecords(packet);
    for (const record of records) {
        if (record.name === ANDROID_TV_REMOTE_SERVICE && record.type === PTR) {
            const serviceName = parsePtr(packet, record);
            if (!serviceName) {
                continue;
            }
            const key = serviceName.toLowerCase();
            if (!services.has(key) && services.size < MAX_SERVICES) {
                services.set(key, { serviceName });
            }
        } else if (record.type === A || record.type === AAAA) {
            const address = decodeAddress(record);
            if (address) {
                addAddress(addressRecords, record.name, address);
            }
        } else if (record.type === SRV || record.type === TXT) {
            if (!serviceMetadata.has(record.name) && serviceMetadata.size >= MAX_SERVICES * 2) {
                continue;
            }
            const metadata = serviceMetadata.get(record.name) ?? { txtMetadata: {}, txtEntryCount: 0, txtByteCount: 0 };
            if (record.type === SRV) {
                const srv = parseSrv(packet, record);
                if (srv) {
                    metadata.hostname = srv.hostname ?? metadata.hostname;
                    metadata.port = srv.port ?? metadata.port;
                }
            } else {
                mergeTxt(metadata, parseTxt(record.data));
            }
            serviceMetadata.set(record.name, metadata);
        }
    }
}

function buildQuery(): Buffer {
    const labels = ANDROID_TV_REMOTE_SERVICE.slice(0, -1).split('.');
    const name = Buffer.concat([
        ...labels.map(label => Buffer.concat([Buffer.from([label.length]), Buffer.from(label)])),
        Buffer.from([0]),
    ]);
    const header = Buffer.alloc(12);
    header.writeUInt16BE(1, 4);
    const question = Buffer.alloc(4);
    question.writeUInt16BE(PTR, 0);
    question.writeUInt16BE(1, 2);
    return Buffer.concat([header, name, question]);
}

function validMacAddress(value: string | undefined): string | undefined {
    return value && /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$|^(?:[0-9a-f]{2}-){5}[0-9a-f]{2}$/i.test(value)
        ? value
        : undefined;
}

function safeError(options: DiscoveryOptions, family: 'udp4' | 'udp6', error: Error): void {
    try {
        options.onError?.(family, error);
    } catch {
        // Error reporting must not interrupt cleanup or the other address-family scan.
    }
}

/**
 * Discover Android TV Remote v2 services on the local network for a bounded period.
 *
 * @param options - Scan duration, socket overrides, cancellation signal and error callback.
 */
export function discoverAndroidTvs(options: DiscoveryOptions = {}): Promise<DiscoveredAndroidTv[]> {
    const timeoutMs = Math.max(0, Math.min(options.timeoutMs ?? 2000, 10_000));
    const createSocket =
        options.createSocket ?? ((family: 'udp4' | 'udp6') => createDgramSocket({ type: family, reuseAddr: true }));
    const schedule = options.setTimeout ?? setTimeout;
    const cancel = options.clearTimeout ?? ((timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>));
    const services = new Map<string, ServiceInfo>();
    const serviceMetadata = new Map<string, ServiceMetadata>();
    const addressRecords = new Map<string, Set<string>>();
    const sockets: DiscoverySocket[] = [];
    const listeners: Array<{
        socket: DiscoverySocket;
        message: (packet: Buffer) => void;
        error: (error: Error) => void;
    }> = [];
    let timer: unknown;
    let hasTimer = false;
    let finished = false;

    return new Promise(resolve => {
        let abortListener: (() => void) | undefined;
        const close = (): void => {
            if (finished) {
                return;
            }
            finished = true;
            if (hasTimer) {
                cancel(timer);
                hasTimer = false;
            }
            if (abortListener) {
                options.signal?.removeEventListener('abort', abortListener);
            }
            for (const { socket, message, error } of listeners) {
                try {
                    socket.off('message', message);
                    socket.off('error', error);
                } catch {
                    // Continue cleaning up other sockets if a platform socket has already failed.
                }
            }
            for (const socket of sockets) {
                try {
                    socket.close();
                } catch {
                    // A socket may already have closed after a platform-level error.
                }
            }

            const devices: DiscoveredAndroidTv[] = [];
            for (const info of services.values()) {
                const metadata = serviceMetadata.get(info.serviceName.toLowerCase());
                const hostname = metadata?.hostname;
                const addresses = hostname ? [...(addressRecords.get(hostname.toLowerCase()) ?? [])] : [];
                const txtMetadata = metadata?.txtMetadata ?? {};
                const deviceName = getTxtValue(txtMetadata, 'fn');
                const model = getTxtValue(txtMetadata, 'md', 'model');
                const manufacturer = getTxtValue(txtMetadata, 'mf', 'manufacturer');
                const macAddress = validMacAddress(txtMetadata.bt);
                devices.push({
                    serviceName: info.serviceName,
                    ...(hostname ? { hostname } : {}),
                    ...(addresses[0] ? { address: addresses[0] } : {}),
                    addresses,
                    ...(metadata?.port ? { port: metadata.port } : {}),
                    txtMetadata,
                    ...(deviceName ? { deviceName } : {}),
                    ...(model ? { model } : {}),
                    ...(manufacturer ? { manufacturer } : {}),
                    ...(macAddress ? { macAddress } : {}),
                    connectionTypeSuggestion: 'remote-v2',
                });
            }
            resolve(deduplicateAndroidTvs(devices));
        };

        if (options.signal) {
            abortListener = close;
            if (options.signal.aborted) {
                close();
                return;
            }
            options.signal.addEventListener('abort', abortListener, { once: true });
        }

        const query = buildQuery();
        for (const [family, multicastAddress] of [
            ['udp4', MDNS_IPV4],
            ['udp6', MDNS_IPV6],
        ] as const) {
            if (finished) {
                break;
            }
            try {
                const socket = createSocket(family);
                sockets.push(socket);
                const message = (packet: Buffer): void => {
                    if (!finished) {
                        parseResponse(packet, services, serviceMetadata, addressRecords);
                    }
                };
                const error = (cause: Error): void => safeError(options, family, cause);
                listeners.push({ socket, message, error });
                socket.on('message', message);
                socket.on('error', error);
                socket.bind(MDNS_PORT, undefined, () => {
                    if (finished) {
                        return;
                    }
                    try {
                        socket.addMembership(multicastAddress);
                        socket.send(query, MDNS_PORT, multicastAddress, cause => {
                            if (cause) {
                                safeError(options, family, cause);
                            }
                        });
                    } catch (cause) {
                        safeError(options, family, cause instanceof Error ? cause : new Error(String(cause)));
                    }
                });
            } catch (cause) {
                safeError(options, family, cause instanceof Error ? cause : new Error(String(cause)));
            }
        }

        if (!finished) {
            timer = schedule(close, timeoutMs);
            if (finished) {
                cancel(timer);
            } else {
                hasTimer = true;
            }
        }
    });
}
