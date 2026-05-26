const { t } = require('../services/i18n');

function mainMenu(lang) {
  return {
    inline_keyboard: [
      [
        { text: t('menu.profile', {}, lang), callback_data: 'menu:profile' },
        { text: t('menu.history', {}, lang), callback_data: 'menu:history' },
      ],
      [
        { text: t('menu.settings', {}, lang), callback_data: 'menu:settings' },
        { text: t('menu.language', {}, lang), callback_data: 'menu:language' },
      ],
      [
        { text: t('menu.stats', {}, lang), callback_data: 'menu:stats' },
        { text: t('menu.premium', {}, lang), callback_data: 'menu:premium' },
      ],
      [
        { text: t('menu.support', {}, lang), callback_data: 'menu:support' },
        { text: t('menu.about', {}, lang), callback_data: 'menu:about' },
      ],
    ],
  };
}

function languageMenu() {
  return {
    inline_keyboard: [
      [
        { text: '🇬🇧 English', callback_data: 'lang:en' },
        { text: '🇰🇭 ខ្មែរ', callback_data: 'lang:km' },
      ],
      [
        { text: '🇵🇱 Polski', callback_data: 'lang:pl' },
        { text: '🇰🇷 한국어', callback_data: 'lang:ko' },
      ],
      [{ text: '🔙', callback_data: 'menu:home' }],
    ],
  };
}

function backHome(lang) {
  return {
    inline_keyboard: [[{ text: t('menu.back', {}, lang), callback_data: 'menu:home' }]],
  };
}

function settingsMenu(user, lang) {
  const onOff = (v) => (v ? t('settings.on', {}, lang) : t('settings.off', {}, lang));
  return {
    inline_keyboard: [
      [{ text: `🎬 ${t('settings.preferHD', {}, lang)}: ${onOff(user.settings?.preferHD)}`, callback_data: 'set:preferHD' }],
      [{ text: `🎧 ${t('settings.audioOnly', {}, lang)}: ${onOff(user.settings?.audioOnly)}`, callback_data: 'set:audioOnly' }],
      [{ text: `🔔 ${t('settings.notify', {}, lang)}: ${onOff(user.settings?.notify)}`, callback_data: 'set:notify' }],
      [{ text: t('menu.back', {}, lang), callback_data: 'menu:home' }],
    ],
  };
}

module.exports = { mainMenu, languageMenu, backHome, settingsMenu };
