import { describe, expect, it } from 'vitest'
import { aborted, fakePlatformContext } from '../../../tests/setup/platform-context'
import { addScheme, declaresScheme, mobile } from '../src'

describe('mobile()', () => {
  it('defaults to both targets and validates them', () => {
    expect(mobile().options).toMatchObject({ targets: ['ios', 'android'], port: 3100 })
    expect(mobile({ targets: ['android'] }).options.targets).toEqual(['android'])
    expect(() => mobile({ targets: ['ios', 'windows' as any] })).toThrow(
      /targets must be ios or android, got windows/,
    )
  })

  it('installs Capacitor and one package per target', () => {
    const names = mobile({ targets: ['ios'] }).dependencies!.map((d) => d.name)
    expect(names).toContain('@capacitor/ios')
    expect(names).not.toContain('@capacitor/android')
    expect(names).toEqual(
      expect.arrayContaining(['@capacitor/core', '@capacitor/cli', '@capacitor/preferences']),
    )
    expect(mobile().definition.requires).toEqual(['router', 'platform', 'storage'])
  })

  describe('scaffold', () => {
    it('writes capacitor.config.ts pointing at the client build, with a derived app id', () => {
      const phone = mobile()
      const f = fakePlatformContext(phone, {
        name: 'phone',
        files: { 'package.json': JSON.stringify({ name: '@acme/field-notes' }) },
      })
      phone.scaffold!(f.ctx)
      const config = f.files.get('platforms/phone/capacitor.config.ts')!
      expect(config).toContain("appId: 'com.example.fieldnotes'")
      expect(config).toContain("appName: 'Field Notes'")
      expect(config).toContain("webDir: '../../dist/phone/client'")
      expect(config).toContain('process.env.CAP_SERVER_URL')
      expect(f.files.get('platforms/phone/.gitignore')).toContain('ios/App/Pods')
    })

    it('uses appId, appName and extra Capacitor config from the options, escaping quotes', () => {
      const phone = mobile({
        appId: 'dev.kitr.notes',
        appName: "Platon's Notes",
        capacitor: { plugins: { SplashScreen: { launchShowDuration: 0 } } },
      })
      const f = fakePlatformContext(phone, { files: { 'package.json': '{}' } })
      phone.scaffold!(f.ctx)
      const config = f.files.get('platforms/app/capacitor.config.ts')!
      expect(config).toContain("appId: 'dev.kitr.notes'")
      expect(config).toContain("appName: 'Platon\\'s Notes'")
      expect(config).toContain('"launchShowDuration": 0')
    })
  })

  describe('shell package.json', () => {
    it('lists the app dependencies, so cap finds every Capacitor plugin the app installed', () => {
      const phone = mobile()
      const f = fakePlatformContext(phone, {
        name: 'phone',
        files: {
          'package.json': JSON.stringify({
            name: 'app',
            dependencies: { '@capacitor/haptics': '^8.0.2', react: '^19.0.0' },
            devDependencies: { vitest: '^5.0.0' },
          }),
        },
      })
      phone.scaffold!(f.ctx)
      const shell = JSON.parse(f.files.get('platforms/phone/package.json')!)
      expect(shell).toMatchObject({
        name: 'phone-shell',
        private: true,
        dependencies: { '@capacitor/haptics': '^8.0.2', react: '^19.0.0' },
      })
      expect(shell.devDependencies).toBeUndefined()
    })

    it('is refreshed before cap runs, so plugins added later are synced', async () => {
      const phone = mobile()
      const f = fakePlatformContext(phone, {
        name: 'phone',
        files: {
          'package.json': JSON.stringify({ dependencies: { '@capacitor/share': '^8.0.3' } }),
          'platforms/phone/package.json': '{}',
          'platforms/phone/ios/x': '',
          'platforms/phone/android/x': '',
        },
      })
      await phone.build!(f.ctx)
      expect(JSON.parse(f.files.get('platforms/phone/package.json')!).dependencies).toEqual({
        '@capacitor/share': '^8.0.3',
      })
    })
  })

  describe('build', () => {
    it('builds the bundle, creates missing native projects and syncs', async () => {
      const phone = mobile()
      const f = fakePlatformContext(phone, {
        name: 'phone',
        files: { 'platforms/phone/ios/App/App.xcodeproj': '' },
      })
      await phone.build!(f.ctx)
      expect(f.calls.map((c) => [c.command, ...c.args])).toEqual([
        ['vite', 'build'],
        ['cap', 'add', 'android'],
        ['cap', 'sync'],
      ])
      expect(f.calls.slice(1).every((c) => c.cwd === '/project/platforms/phone')).toBe(true)
    })

    it('builds only the targets asked for, and opens them with --open', async () => {
      const phone = mobile()
      const f = fakePlatformContext(phone, {
        name: 'phone',
        flags: { target: 'ios', open: true },
        files: { 'platforms/phone/ios/x': '' },
      })
      await phone.build!(f.ctx)
      expect(f.calls.map((c) => [c.command, ...c.args])).toEqual([
        ['vite', 'build'],
        ['cap', 'sync'],
        ['cap', 'open', 'ios'],
      ])
    })

    it('rejects a target the platform does not have', async () => {
      const phone = mobile({ targets: ['android'] })
      const f = fakePlatformContext(phone, { name: 'phone', flags: { target: 'ios' } })
      await expect(phone.build!(f.ctx)).rejects.toThrow(
        /phone has no ios target \(targets: android\)/,
      )
    })
  })

  it('dev serves Vite on the LAN for the device and runs the chosen target against it', async () => {
    const phone = mobile()
    const f = fakePlatformContext(phone, {
      name: 'phone',
      flags: { target: 'android', host: '192.168.1.5', port: 3300 },
      files: { 'platforms/phone/android/x': '' },
      signal: aborted(),
    })
    await phone.dev!(f.ctx)
    expect(f.calls.map((c) => [c.command, ...c.args])).toEqual([
      ['vite', 'dev', '--port', '3300', '--strictPort', '--host', '192.168.1.5'],
      ['cap', 'run', 'android', '--no-sync'],
    ])
    expect(f.calls[1]!.env).toEqual({ CAP_SERVER_URL: 'http://192.168.1.5:3300' })
  })

  it('doctor lists missing packages, config and native projects', () => {
    const phone = mobile({ targets: ['ios'] })
    const f = fakePlatformContext(phone, { name: 'phone', files: { 'package.json': '{}' } })
    const findings = phone.doctor!(f.ctx) as any[]
    expect(findings.filter((x) => x.level === 'error').map((x) => x.message)).toContain(
      'phone: @capacitor/ios is not installed',
    )
    expect(findings.map((x) => x.message)).toContain(
      'phone: platforms/phone/capacitor.config.ts is missing',
    )
    expect(findings.find((x) => x.level === 'info')?.message).toBe(
      'phone: the ios project is not created yet',
    )
  })

  // `scheme` reaches the native projects, so acme:// links open the app.
  describe('scheme', () => {
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
\t<key>CFBundleName</key>
\t<string>App</string>
</dict>
</plist>
`
    const manifest = `<manifest>
    <application>
        <activity android:name=".MainActivity">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`

    it('adds the scheme to Info.plist and the manifest once', () => {
      const ios = addScheme('ios', plist, 'acme')
      expect(declaresScheme('ios', ios, 'acme')).toBe(true)
      expect(ios).toContain('<key>CFBundleURLTypes</key>')
      expect(addScheme('ios', ios, 'acme')).toBe(ios)
      const second = addScheme('ios', ios, 'other')
      expect(second.match(/CFBundleURLTypes/g)).toHaveLength(1)
      expect(declaresScheme('ios', second, 'other')).toBe(true)
      const android = addScheme('android', manifest, 'acme')
      expect(android).toContain('<data android:scheme="acme" />')
      expect(android.indexOf('android:scheme')).toBeLessThan(android.indexOf('</activity>'))
      expect(addScheme('android', android, 'acme')).toBe(android)
    })

    it('build registers it in both native projects, and doctor notices when it is missing', async () => {
      const phone = mobile({ scheme: 'acme' })
      const f = fakePlatformContext(phone, {
        name: 'phone',
        files: {
          'package.json': '{}',
          'platforms/phone/ios/App/App/Info.plist': plist,
          'platforms/phone/android/app/src/main/AndroidManifest.xml': manifest,
        },
      })
      const warnings = () => (phone.doctor!(f.ctx) as any[]).filter((x) => /scheme/.test(x.message))
      expect(warnings()).toHaveLength(2)
      await phone.build!(f.ctx)
      expect(f.files.get('platforms/phone/ios/App/App/Info.plist')).toContain(
        '<string>acme</string>',
      )
      expect(f.files.get('platforms/phone/android/app/src/main/AndroidManifest.xml')).toContain(
        'android:scheme="acme"',
      )
      expect(warnings()).toEqual([])
    })
  })
})
