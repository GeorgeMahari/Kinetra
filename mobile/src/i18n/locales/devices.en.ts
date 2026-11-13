const devicesEn = {
  devices: {
    title: 'Connected data',
    rowHint: 'Health Connect: heart rate, weight, steps',
    intro: 'On Android, Kinetra can read three kinds of data from Health Connect: resting heart rate, weight and daily steps, for the last 30 days. It only reads. It never writes or changes anything in Health Connect.',
    howUsed: 'Imported values are stored as device data, labelled with their source. They never become test results: your assessments still come from the tests you do.',
    statusTitle: 'On this device',
    status: {
      unsupported_platform: 'Health Connect is only available on Android. Apple Health is not supported yet.',
      needs_dev_build: 'This version of the app can’t reach Health Connect (for example Expo Go). Open the Kinetra development build to connect.',
      not_installed: 'Health Connect isn’t available on this phone. On Android 13 or older, install it from Google Play.',
      update_required: 'Health Connect needs an update from Google Play before Kinetra can use it.',
    },
    permissions: '{{granted}} of 3 data types allowed',
    allow: 'Allow access',
    sync: 'Sync the last 30 days',
    openSettings: 'Manage in Health Connect',
    noneGranted: 'No access was allowed. You can change this at any time in Health Connect.',
    syncResult: 'Synced: {{inserted}} new, {{updated}} updated.',
    syncNothing: 'Synced: no new data in the last 30 days.',
    importedTitle: 'Imported data',
    importedNone: 'Nothing imported yet.',
    importedCount: '{{count}} values · last sync {{date}}',
    latest: {
      resting_hr_bpm: 'Resting heart rate',
      weight_kg: 'Weight',
      steps_daily: 'Steps (latest day)',
    },
    units: {
      resting_hr_bpm: 'bpm',
      weight_kg: 'kg',
      steps_daily: 'steps',
    },
    latestValue: '{{value}} {{unit}} · {{date}}',
    source: 'Source: Health Connect',
    remove: 'Remove imported data',
    removeWarning: 'Deletes every value imported from Health Connect from your Kinetra account. Your data in Health Connect stays as it is.',
    removeConfirm: 'Yes, remove',
    cancel: 'Cancel',
    removed: 'Imported data removed.',
  },
};

export default devicesEn;
