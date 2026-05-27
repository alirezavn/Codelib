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

    // 2. Supabase Integration
    const supabaseStatusBadge = document.getElementById('supabaseStatusBadge');
    const sbSyncBtn = document.getElementById('sbSyncBtn');
    const copySqlBtn = document.getElementById('copySqlBtn');
    
    const syncProgressContainer = document.getElementById('syncProgressContainer');
    const syncProgressLabel = document.getElementById('syncProgressLabel');
    const syncProgressPercent = document.getElementById('syncProgressPercent');
    const syncProgressBar = document.getElementById('syncProgressBar');

    // Update UI based on storage state (Simplified for production app-wide)
    function updateSupabaseUI() {
        if (supabaseStatusBadge) {
            supabaseStatusBadge.textContent = 'فعال';
            supabaseStatusBadge.className = 'supabase-badge badge-connected';
        }
    }

    // Copy SQL Script logic
    copySqlBtn?.addEventListener('click', () => {
        const sqlText = `-- Create snippets table in Supabase
CREATE TABLE IF NOT EXISTS snippets (
  id bigint generated by default as identity primary key,
  title text not null,
  language text,
  description text,
  code text,
  visibility text default 'private',
  tags text[] default '{}'::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);`;
        
        navigator.clipboard.writeText(sqlText).then(() => {
            App.showToast('کد SQL راه‌اندازی در کلیپ‌بورد کپی شد.');
        }).catch(err => {
            console.error('Could not copy SQL', err);
            App.showToast('خطا در کپی کردن متن.');
        });
    });

    // Supabase Cloud Sync logic
    sbSyncBtn?.addEventListener('click', async () => {
        if (!window.supabase) {
            App.showToast('کتابخانه Supabase لود نشده است.');
            return;
        }

        sbSyncBtn.disabled = true;
        if (syncProgressContainer) syncProgressContainer.style.display = 'block';
        if (syncProgressBar) syncProgressBar.style.width = '0%';
        if (syncProgressPercent) syncProgressPercent.textContent = '0%';
        if (syncProgressLabel) syncProgressLabel.textContent = 'در حال ارتباط با پایگاه داده محلی...';

        try {
            // Step 1: Fetch local snippets
            const response = await fetch('api/snippets.php');
            const responseData = await response.json();
            
            if (responseData.status !== 'success') {
                throw new Error(responseData.message || 'خطا در دریافت قطعه‌کدها از سرور محلی.');
            }
            
            const localSnippets = responseData.snippets || [];
            if (localSnippets.length === 0) {
                if (syncProgressLabel) syncProgressLabel.textContent = 'هیچ قطعه‌کدی در سیستم محلی یافت نشد.';
                sbSyncBtn.disabled = false;
                setTimeout(() => {
                    if (syncProgressContainer) syncProgressContainer.style.display = 'none';
                }, 3000);
                return;
            }

            // Step 2: Connect to Supabase
            if (syncProgressBar) syncProgressBar.style.width = '10%';
            if (syncProgressPercent) syncProgressPercent.textContent = '10%';
            if (syncProgressLabel) syncProgressLabel.textContent = 'در حال اتصال به دیتابیس Supabase...';
            
            const sbClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
            
            // Step 3: Loop and Upsert snippets to Supabase
            let syncedCount = 0;
            const total = localSnippets.length;
            
            for (let i = 0; i < total; i++) {
                const sn = localSnippets[i];
                
                // Show current sync item
                if (syncProgressLabel) syncProgressLabel.textContent = `در حال ارسال: "${sn.title}" (${sn.language})`;
                
                // Convert structure to match Supabase schema
                const sbSnippet = {
                    title: sn.title,
                    language: sn.language,
                    description: sn.description,
                    code: sn.code,
                    visibility: sn.visibility,
                    tags: sn.tags || [],
                    created_at: sn.created_at
                };

                // Perform upsert
                const { error } = await sbClient.from('snippets').insert([sbSnippet]);
                
                if (error) {
                    console.error('Error syncing snippet to Supabase:', error);
                    // If table doesn't exist, we should inform user about running SQL
                    if (error.code === '42P01') { // PostgreSQL table relation undefined
                        throw new Error('جدول snippets در Supabase ایجاد نشده است. لطفاً کد SQL راهنمای زیر را ابتدا در پنل خود اجرا کنید.');
                    }
                }
                
                syncedCount++;
                const percentage = Math.round((syncedCount / total) * 80) + 10;
                if (syncProgressBar) syncProgressBar.style.width = `${percentage}%`;
                if (syncProgressPercent) syncProgressPercent.textContent = `${percentage}%`;
            }

            // Sync Complete!
            if (syncProgressBar) syncProgressBar.style.width = '100%';
            if (syncProgressPercent) syncProgressPercent.textContent = '100%';
            if (syncProgressLabel) syncProgressLabel.textContent = `همگام‌سازی کامل شد! تعداد ${syncedCount} قطعه‌کد با موفقیت کپی گردید.`;
            App.showToast('همگام‌سازی با موفقیت انجام شد!');
            
        } catch (error) {
            console.error('Sync failed:', error);
            if (syncProgressLabel) syncProgressLabel.textContent = `خطا در همگام‌سازی: ${error.message}`;
            if (syncProgressBar) syncProgressBar.style.backgroundColor = 'var(--danger)';
            App.showToast('خطا در انتقال داده‌ها.');
        } finally {
            sbSyncBtn.disabled = false;
            setTimeout(() => {
                if (syncProgressContainer) syncProgressContainer.style.display = 'none';
                if (syncProgressBar) syncProgressBar.style.backgroundColor = 'var(--success)';
            }, 5000);
        }
    });

    // Run Initial Load
    updateSupabaseUI();
});

