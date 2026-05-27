const settingsDefaults = {
    theme: 'dark',
    compactCards: false,
    tabSize: '4',
    defaultVisibility: 'private',
    lineWrap: true,
    autosaveLabel: true
};

const settingsInputs = {
    lightTheme: document.getElementById('lightThemeSetting'),
    compactCards: document.getElementById('compactCardsSetting'),
    tabSize: document.getElementById('tabSizeSetting'),
    defaultVisibility: document.getElementById('defaultVisibilitySetting'),
    lineWrap: document.getElementById('lineWrapSetting'),
    autosaveLabel: document.getElementById('autosaveLabelSetting')
};

function readSettings() {
    return {
        theme: localStorage.getItem('theme') || settingsDefaults.theme,
        compactCards: localStorage.getItem('compactCards') === 'true',
        tabSize: localStorage.getItem('tabSize') || settingsDefaults.tabSize,
        defaultVisibility: localStorage.getItem('defaultVisibility') || settingsDefaults.defaultVisibility,
        lineWrap: localStorage.getItem('lineWrap') !== 'false',
        autosaveLabel: localStorage.getItem('autosaveLabel') !== 'false'
    };
}

function applyFormValues(settings) {
    settingsInputs.lightTheme.checked = settings.theme === 'light';
    settingsInputs.compactCards.checked = settings.compactCards;
    settingsInputs.tabSize.value = settings.tabSize;
    settingsInputs.defaultVisibility.value = settings.defaultVisibility;
    settingsInputs.lineWrap.checked = settings.lineWrap;
    settingsInputs.autosaveLabel.checked = settings.autosaveLabel;
}

function saveSetting(key, value) {
    localStorage.setItem(key, String(value));
}

settingsInputs.lightTheme?.addEventListener('change', (event) => {
    const theme = event.target.checked ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    App.updateThemeIcon(theme);
});

settingsInputs.compactCards?.addEventListener('change', (event) => {
    saveSetting('compactCards', event.target.checked);
    document.body.classList.toggle('compact-cards', event.target.checked);
});

settingsInputs.tabSize?.addEventListener('change', (event) => {
    saveSetting('tabSize', event.target.value);
});

settingsInputs.defaultVisibility?.addEventListener('change', (event) => {
    saveSetting('defaultVisibility', event.target.value);
});

settingsInputs.lineWrap?.addEventListener('change', (event) => {
    saveSetting('lineWrap', event.target.checked);
});

settingsInputs.autosaveLabel?.addEventListener('change', (event) => {
    saveSetting('autosaveLabel', event.target.checked);
});

document.getElementById('resetPreferencesBtn')?.addEventListener('click', () => {
    Object.entries(settingsDefaults).forEach(([key, value]) => {
        localStorage.setItem(key, String(value));
    });
    localStorage.setItem('theme', settingsDefaults.theme);
    document.documentElement.setAttribute('data-theme', settingsDefaults.theme);
    App.updateThemeIcon(settingsDefaults.theme);
    document.body.classList.remove('compact-cards');
    applyFormValues(settingsDefaults);
    App.showToast('تنظیمات به حالت پیش فرض برگشت.');
});

document.getElementById('logoutSettingsBtn')?.addEventListener('click', () => {
    App.logout();
});

const currentSettings = readSettings();
applyFormValues(currentSettings);
document.body.classList.toggle('compact-cards', currentSettings.compactCards);

/* ==========================================================================
   Tab Navigation & Supabase Integration Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Tab Navigation
    const tabItems = document.querySelectorAll('.tab-item');
    const tabContents = document.querySelectorAll('.tab-content');

    tabItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            
            // Remove active classes
            tabItems.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active classes
            item.classList.add('active');
            const contentPanel = document.getElementById(`tab-${targetTab}`);
            if (contentPanel) contentPanel.classList.add('active');
        });
    });

    // Tab Navigation is the only remaining logic for settings
});

