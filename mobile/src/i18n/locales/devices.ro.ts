const devicesRo = {
  devices: {
    title: 'Date conectate',
    rowHint: 'Health Connect: puls, greutate, pași',
    intro: 'Pe Android, Kinetra poate citi trei tipuri de date din Health Connect: pulsul în repaus, greutatea și pașii zilnici, pentru ultimele 30 de zile. Doar citește. Nu scrie și nu modifică nimic în Health Connect.',
    howUsed: 'Valorile importate sunt păstrate ca date de la dispozitiv, marcate cu sursa lor. Nu devin niciodată rezultate de test: evaluările tale vin în continuare din testele pe care le faci.',
    statusTitle: 'Pe acest dispozitiv',
    status: {
      unsupported_platform: 'Health Connect este disponibil doar pe Android. Apple Health nu este încă suportat.',
      needs_dev_build: 'Această versiune a aplicației nu poate accesa Health Connect (de exemplu Expo Go). Deschide versiunea de dezvoltare Kinetra ca să te conectezi.',
      not_installed: 'Health Connect nu este disponibil pe acest telefon. Pe Android 13 sau mai vechi, instalează-l din Google Play.',
      update_required: 'Health Connect trebuie actualizat din Google Play înainte ca Kinetra să-l poată folosi.',
    },
    permissions: '{{granted}} din 3 tipuri de date permise',
    allow: 'Permite accesul',
    sync: 'Sincronizează ultimele 30 de zile',
    openSettings: 'Gestionează în Health Connect',
    noneGranted: 'Nu ai permis niciun acces. Poți schimba asta oricând din Health Connect.',
    syncResult: 'Sincronizat: {{inserted}} noi, {{updated}} actualizate.',
    syncNothing: 'Sincronizat: nicio dată nouă în ultimele 30 de zile.',
    importedTitle: 'Date importate',
    importedNone: 'Nimic importat încă.',
    importedCount: '{{count}} valori · ultima sincronizare {{date}}',
    latest: {
      resting_hr_bpm: 'Puls în repaus',
      weight_kg: 'Greutate',
      steps_daily: 'Pași (ultima zi)',
    },
    units: {
      resting_hr_bpm: 'bpm',
      weight_kg: 'kg',
      steps_daily: 'pași',
    },
    latestValue: '{{value}} {{unit}} · {{date}}',
    source: 'Sursa: Health Connect',
    remove: 'Șterge datele importate',
    removeWarning: 'Șterge din contul tău Kinetra toate valorile importate din Health Connect. Datele tale din Health Connect rămân neschimbate.',
    removeConfirm: 'Da, șterge',
    cancel: 'Anulează',
    removed: 'Datele importate au fost șterse.',
  },
};

export default devicesRo;
