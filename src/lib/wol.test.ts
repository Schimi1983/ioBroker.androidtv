import { expect } from 'chai';
import { createSocket } from 'node:dgram';
import { parseMacOutput } from './adb/parsers';
import { magicPacket, parseMac, sendWakeOnLan, wolTargets } from './wol';

describe('wake-on-lan', () => {
    it('parses MAC addresses in common notations', () => {
        expect(parseMac('AA:bb:cc:dd:ee:ff')?.toString('hex')).to.equal('aabbccddeeff');
        expect(parseMac('aa-bb-cc-dd-ee-ff')?.toString('hex')).to.equal('aabbccddeeff');
        expect(parseMac('aabbccddeeff')?.toString('hex')).to.equal('aabbccddeeff');
        expect(parseMac('00:00:00:00:00:00')).to.equal(undefined);
        expect(parseMac('aa:bb')).to.equal(undefined);
        expect(parseMac(undefined)).to.equal(undefined);
    });

    it('builds the magic packet', () => {
        const packet = magicPacket(Buffer.from('aabbccddeeff', 'hex'));
        expect(packet.length).to.equal(102);
        expect(packet.subarray(0, 6).toString('hex')).to.equal('ffffffffffff');
        expect(packet.subarray(96).toString('hex')).to.equal('aabbccddeeff');
    });

    it('sends to broadcast, directed broadcast and the device itself', () => {
        expect(wolTargets('192.168.20.105')).to.have.members(['255.255.255.255', '192.168.20.255', '192.168.20.105']);
        expect(wolTargets('192.168.20.105', '10.0.0.255')).to.include('10.0.0.255');
        expect(wolTargets('fd00::5')).to.deep.equal(['fd00::5']);
        expect(wolTargets('192.168.20.105', 'nonsense')).to.not.include('nonsense');
    });

    it('delivers the packet via UDP', async () => {
        const server = createSocket('udp4');
        await new Promise<void>(resolve => server.bind(0, '127.0.0.1', resolve));
        const received = new Promise<Buffer>(resolve => server.once('message', msg => resolve(msg)));
        try {
            const sent = await sendWakeOnLan('aa:bb:cc:dd:ee:ff', ['127.0.0.1'], server.address().port);
            expect(sent).to.equal(3);
            const msg = await received;
            expect(msg.length).to.equal(102);
        } finally {
            server.close();
        }
    });

    it('rejects invalid MAC addresses', async () => {
        await sendWakeOnLan('xx', ['127.0.0.1']).then(
            () => expect.fail('accepted'),
            (e: Error) => expect(e.message).to.match(/Invalid MAC/),
        );
    });

    it('reads the MAC address from the ADB output', () => {
        const output = [
            '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\\    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00',
            '2: eth0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 state DOWN\\    link/ether 11:22:33:44:55:66 brd ff:ff:ff:ff:ff:ff',
            '3: wlan0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP\\    link/ether A0:B1:C2:D3:E4:F5 brd ff:ff:ff:ff:ff:ff',
            '---IOBATV---',
            '1: lo    inet 127.0.0.1/8 scope host lo\\       valid_lft forever',
            '3: wlan0    inet 192.168.20.105/24 brd 192.168.20.255 scope global wlan0\\       valid_lft forever',
        ].join('\n');
        expect(parseMacOutput(output, '192.168.20.105')).to.equal('a0:b1:c2:d3:e4:f5');
        expect(parseMacOutput(output, '10.0.0.1')).to.equal(undefined); // two interfaces up, IP unknown
        expect(parseMacOutput('')).to.equal(undefined);
    });
});
