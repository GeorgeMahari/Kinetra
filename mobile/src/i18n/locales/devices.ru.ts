const devicesRu = {
  devices: {
    title: 'Подключённые данные',
    rowHint: 'Health Connect: пульс, вес, шаги',
    intro: 'На Android Kinetra может читать из Health Connect три вида данных: пульс в покое, вес и шаги за день, за последние 30 дней. Только чтение. Kinetra ничего не записывает и не меняет в Health Connect.',
    howUsed: 'Импортированные значения хранятся как данные устройства с указанием источника. Они никогда не становятся результатами тестов: ваши оценки по-прежнему основаны на тестах, которые вы проходите.',
    statusTitle: 'На этом устройстве',
    status: {
      unsupported_platform: 'Health Connect доступен только на Android. Apple Health пока не поддерживается.',
      needs_dev_build: 'Эта версия приложения не может обратиться к Health Connect (например, Expo Go). Откройте сборку Kinetra для разработки, чтобы подключиться.',
      not_installed: 'Health Connect недоступен на этом телефоне. На Android 13 и более ранних версиях установите его из Google Play.',
      update_required: 'Перед использованием в Kinetra Health Connect нужно обновить в Google Play.',
    },
    permissions: 'Разрешено типов данных: {{granted}} из 3',
    allow: 'Разрешить доступ',
    sync: 'Синхронизировать последние 30 дней',
    openSettings: 'Управлять в Health Connect',
    noneGranted: 'Доступ не разрешён. Это можно изменить в любой момент в Health Connect.',
    syncResult: 'Синхронизировано: новых {{inserted}}, обновлено {{updated}}.',
    syncNothing: 'Синхронизировано: новых данных за последние 30 дней нет.',
    importedTitle: 'Импортированные данные',
    importedNone: 'Пока ничего не импортировано.',
    importedCount: 'Значений: {{count}} · последняя синхронизация {{date}}',
    latest: {
      resting_hr_bpm: 'Пульс в покое',
      weight_kg: 'Вес',
      steps_daily: 'Шаги (последний день)',
    },
    units: {
      resting_hr_bpm: 'уд/мин',
      weight_kg: 'кг',
      steps_daily: 'шагов',
    },
    latestValue: '{{value}} {{unit}} · {{date}}',
    source: 'Источник: Health Connect',
    remove: 'Удалить импортированные данные',
    removeWarning: 'Удаляет из вашего аккаунта Kinetra все значения, импортированные из Health Connect. Ваши данные в Health Connect не изменятся.',
    removeConfirm: 'Да, удалить',
    cancel: 'Отмена',
    removed: 'Импортированные данные удалены.',
  },
};

export default devicesRu;
