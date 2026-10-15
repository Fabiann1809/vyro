const ATTRIBUTION = /^co-authored-by:|generated with .*(claude|copilot|chatgpt)|🤖/im

// Rejects any AI/tool attribution: the repository has a single author.
const noAttribution = (parsed) => {
  const text = parsed.raw ?? ''
  return [
    !ATTRIBUTION.test(text),
    'commit message must not contain Co-Authored-By trailers or AI/tool attribution'
  ]
}

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [{ rules: { 'no-attribution': noAttribution } }],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'test', 'docs', 'build', 'chore', 'style', 'ci']
    ],
    'scope-enum': [
      2,
      'always',
      [
        'camera',
        'pose',
        'core',
        'engine',
        'skills',
        'ui',
        'voice',
        'i18n',
        'db',
        'ipc',
        'session',
        'settings',
        'a11y',
        'build',
        'ci',
        'deps'
      ]
    ],
    'header-max-length': [2, 'always', 72],
    'subject-full-stop': [2, 'never', '.'],
    'no-attribution': [2, 'always']
  }
}
