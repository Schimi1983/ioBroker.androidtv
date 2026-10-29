/**
 * Wake-on-LAN: wakes devices that switched off their network connection in deep standby
 * (e.g. Fire TV after a while), so neither Remote v2 nor ADB can reach them anymore.
 */
import { createSocket } from 'node:dgram';
import { isIPv4, isIPv6 } from 'node:net';

/** Default UDP port for magic packets. */
export const WOL_PORT = 9;

/**
 * Parses a MAC address ("aa:bb:cc:dd:ee:ff", "aa-bb-…" or "aabbccddeeff").
 *
 * @param mac - MAC address as text
 * @returns 6 bytes or undefined if invalid
 */
export function parseMac(mac: string | null | undefined): Buffer | undefined {
    const hex = (mac ?? '').trim().replace(/[:\-.\s]/g, '');
    if (!/^[0-9a-f]{12}$/i.test(hex) || /^0{12}$/.test(hex)) {
        return undefined;
    }
    return Buffer.from(hex, 'hex');
}

/**
 * Builds the magic packet: 6 × 0xFF followed by the MAC 16 times.
 *
 * @param mac - 6 byte MAC address
 */
export function magicPacket(mac: Buffer): Buffer {
    return Buffer.concat([Buffer.alloc(6, 0xff), ...Array.from({ length: 16 }, () => mac)]);
}

// @KI_HINWEIS: Ein Broadcast verlässt das eigene Netz nicht. Liegt der TV in einem anderen Subnetz/VLAN als
// ioBroker (Feldtest: TVs in 192.168.20.0/24), helfen nur ein gerichteter Broadcast (Router muss ihn weiterleiten)
// oder Unicast an die TV-IP, solange der Router den ARP-Eintrag noch kennt. Deshalb alle drei Ziele senden.
// IPv6 kennt keinen Broadcast: dort nur Unicast an die Adresse des Geräts.
/**
 * Destinations for the magic packet.
 *
 * @param host - IP address of the device
 * @param broadcast - Optional broadcast address from the configuration
 */
export function wolTargets(host: string, broadcast?: string): string[] {
    const targets = new Set<string>();
    const configured = broadcast?.trim();
    if (configured && (isIPv4(configured) || isIPv6(configured))) {
        targets.add(configured);
    }
    if (isIPv4(host)) {
        targets.add('255.255.255.255');
        targets.add(host.replace(/\.\d+$/, '.255'));
        targets.add(host);
    } else if (isIPv6(host)) {
        targets.add(host);
    }
    return [...targets];
}

/**
 * Sends the magic packet to all destinations (each 3 times, UDP is lossy).
 *
 * @param mac - MAC address as text
 * @param targets - Destination addresses, see {@link wolTargets}
 * @param port - UDP port
 * @returns Number of packets sent
 */
export async function sendWakeOnLan(mac: string, targets: string[], port = WOL_PORT): Promise<number> {
    const bytes = parseMac(mac);
    if (!bytes) {
        throw new Error(`Invalid MAC address "${mac}"`);
    }
    const packet = magicPacket(bytes);
    let sent = 0;
    for (const family of ['udp4', 'udp6'] as const) {
        const list = targets.filter(t => (family === 'udp4' ? isIPv4(t) : isIPv6(t)));
        if (!list.length) {
            continue;
        }
        const socket = createSocket(family);
        try {
            await new Promise<void>((resolve, reject) => {
                socket.once('error', reject);
                socket.bind(0, () => {
                    socket.off('error', reject);
                    resolve();
                });
            });
            if (family === 'udp4') {
                socket.setBroadcast(true);
            }
            for (let round = 0; round < 3; round++) {
                for (const target of list) {
                    try {
                        await new Promise<void>((resolve, reject) =>
                            socket.send(packet, port, target, err => (err ? reject(err) : resolve())),
                        );
                        sent++;
                    } catch {
                        // @KI_HINWEIS: Einzelne Ziele dürfen scheitern (z. B. EACCES/ENETUNREACH für ein Netz),
                        // die anderen werden trotzdem versucht.
                    }
                }
            }
        } finally {
            socket.close();
        }
    }
    return sent;
}
