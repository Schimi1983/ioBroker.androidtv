import { expect } from 'chai';
import { appDisplayName } from './app-names';

describe('app names', () => {
    it('uses the name of an app favorite whose link is the package', () => {
        expect(appDisplayName('org.xbmc.kodi', [{ name: 'Mein Kodi', link: 'org.xbmc.kodi' }], 'de')).to.equal(
            'Mein Kodi',
        );
    });

    it('knows common apps and the home screen', () => {
        expect(appDisplayName('com.netflix.ninja', [], 'de')).to.equal('Netflix');
        expect(appDisplayName('com.google.android.tvlauncher', [], 'de')).to.equal('Startbildschirm');
        expect(appDisplayName('com.amazon.tv.launcher', [], 'en')).to.equal('Home screen');
        expect(appDisplayName('com.amazon.tv.inputpreference.service', [], 'de')).to.equal('TV-Eingang (HDMI)');
    });

    it('keeps the package name of unknown apps', () => {
        expect(appDisplayName('com.example.player', [], 'de')).to.equal('com.example.player');
    });
});
