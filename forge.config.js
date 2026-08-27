module.exports = {
  packagerConfig: {
    name: 'Jutoka',
    executableName: 'Jutoka',
    icon: './assets/icon',
    asar: true,
    extraResource: [],
    protocols: [
      { name: 'Jutoka Desktop', schemes: ['jutoka-desktop'] }
    ],
    win: {
      target: ['nsis', 'portable'],
      icon: './assets/icon.ico',
    },
    darwin: {
      target: ['dmg', 'zip'],
      icon: './assets/icon.icns',
      category: 'public.app-category.video',
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'Jutoka',
        title: 'Jutoka Desktop',
        authors: 'Jutoka',
        description: 'Professional rendering without browser limits',
        setupIcon: './assets/icon.ico',
        iconUrl: 'https://jutoka.com/favicon.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'Jutoka Desktop',
        title: 'Jutoka Desktop',
      },
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: { owner: 'jutoka', name: 'jutoka-desktop' },
        prerelease: false,
        draft: true,
      },
    },
  ],
};
