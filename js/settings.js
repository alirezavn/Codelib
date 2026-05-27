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
    const supabaseDisconnectedCard = document.getElementById('supabaseDisconnectedCard');
    const supabaseConfigCard = document.getElementById('supabaseConfigCard');
    const supabaseConnectedCard = document.getElementById('supabaseConnectedCard');
    
    const supabaseConnectBtn = document.getElementById('supabaseConnectBtn');
    const sbCancelBtn = document.getElementById('sbCancelBtn');
    const supabaseForm = document.getElementById('supabaseForm');
    
    const sbUrlInput = document.getElementById('sbUrlInput');
    const sbKeyInput = document.getElementById('sbKeyInput');
    const sbProjectInput = document.getElementById('sbProjectInput');
    const sbFrameworkSelect = document.getElementById('sbFrameworkSelect');
    const sbCustomPrefixGroup = document.getElementById('sbCustomPrefixGroup');
    const sbCustomPrefixInput = document.getElementById('sbCustomPrefixInput');
    const toggleSbKeyBtn = document.getElementById('toggleSbKeyBtn');
    
    const sbDisconnectBtn = document.getElementById('sbDisconnectBtn');
    const sbSyncBtn = document.getElementById('sbSyncBtn');
    const copySqlBtn = document.getElementById('copySqlBtn');
    
    const sbProjectDisplay = document.getElementById('sbProjectDisplay');
    const sbFrameworkDisplay = document.getElementById('sbFrameworkDisplay');
    const sbPrefixDisplay = document.getElementById('sbPrefixDisplay');
    
    const syncProgressContainer = document.getElementById('syncProgressContainer');
    const syncProgressLabel = document.getElementById('syncProgressLabel');
    const syncProgressPercent = document.getElementById('syncProgressPercent');
    const syncProgressBar = document.getElementById('syncProgressBar');

    // Framework Prefix Mapping
    const prefixes = {
        nextjs: 'NEXT_PUBLIC_',
        vite: 'VITE_',
        nuxt: 'NUXT_PUBLIC_',
        sveltekit: 'PUBLIC_',
        astro: 'PUBLIC_'
    };

    // Helper to get prefix for active configuration
    function getPrefix(framework, customVal = '') {
        if (framework === 'other') {
            return customVal.trim() || 'PUBLIC_';
        }
        return prefixes[framework] || '';
    }

    // Toggle Key Visibility
    toggleSbKeyBtn?.addEventListener('click', () => {
        const type = sbKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
        sbKeyInput.setAttribute('type', type);
        const icon = toggleSbKeyBtn.querySelector('i');
        if (icon) {
            icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        }
    });

    // Conditional Display for custom prefix
    sbFrameworkSelect?.addEventListener('change', () => {
        if (sbFrameworkSelect.value === 'other') {
            sbCustomPrefixGroup.style.display = 'block';
        } else {
            sbCustomPrefixGroup.style.display = 'none';
        }
    });

    // Update UI based on storage state
    function updateSupabaseUI() {
        const storedConfig = localStorage.getItem('supabase_config');
        if (storedConfig) {
            try {
                const config = JSON.parse(storedConfig);
                
                // Set Badge
                if (supabaseStatusBadge) {
                    supabaseStatusBadge.textContent = 'متصل شد';
                    supabaseStatusBadge.className = 'supabase-badge badge-connected';
                }
                
                // Display Config
                const displayPrefix = getPrefix(config.framework, config.customPrefix);
                if (sbProjectDisplay) sbProjectDisplay.textContent = `پروژه فعال: ${config.project}`;
                
                // Framework pretty name mapping
                const fwNames = {
                    nextjs: 'Next.js',
                    vite: 'Vite / React',
                    nuxt: 'Nuxt / Vue',
                    sveltekit: 'SvelteKit',
                    astro: 'Astro',
                    other: 'سایر (Other)'
                };
                if (sbFrameworkDisplay) sbFrameworkDisplay.textContent = fwNames[config.framework] || config.framework;
                if (sbPrefixDisplay) sbPrefixDisplay.textContent = displayPrefix;
                
                // Toggle Cards
                if (supabaseDisconnectedCard) supabaseDisconnectedCard.style.display = 'none';
                if (supabaseConfigCard) supabaseConfigCard.style.display = 'none';
                if (supabaseConnectedCard) supabaseConnectedCard.style.display = 'block';
                
                // Pre-fill form fields
                if (sbUrlInput) sbUrlInput.value = config.url || '';
                if (sbKeyInput) sbKeyInput.value = config.key || '';
                if (sbProjectInput) sbProjectInput.value = config.project || '';
                if (sbFrameworkSelect) sbFrameworkSelect.value = config.framework || 'nextjs';
                if (config.framework === 'other') {
                    if (sbCustomPrefixGroup) sbCustomPrefixGroup.style.display = 'block';
                    if (sbCustomPrefixInput) sbCustomPrefixInput.value = config.customPrefix || 'PUBLIC_';
                } else {
                    if (sbCustomPrefixGroup) sbCustomPrefixGroup.style.display = 'none';
                }
            } catch (e) {
                console.error('Error loading Supabase config', e);
                showDisconnectedState();
            }
        } else {
            showDisconnectedState();
        }
    }

    function showDisconnectedState() {
        if (supabaseStatusBadge) {
            supabaseStatusBadge.textContent = 'غیرمتصل';
            supabaseStatusBadge.className = 'supabase-badge badge-disconnected';
        }
        
        if (supabaseDisconnectedCard) supabaseDisconnectedCard.style.display = 'block';
        if (supabaseConfigCard) supabaseConfigCard.style.display = 'none';
        if (supabaseConnectedCard) supabaseConnectedCard.style.display = 'none';
    }

    // Connect Button click - Show Form
    supabaseConnectBtn?.addEventListener('click', () => {
        if (supabaseDisconnectedCard) supabaseDisconnectedCard.style.display = 'none';
        if (supabaseConfigCard) supabaseConfigCard.style.display = 'block';
    });

    // Cancel Button click - Restore default disconnected/connected state
    sbCancelBtn?.addEventListener('click', () => {
        updateSupabaseUI();
    });

    // Save Form Submission
    supabaseForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const url = sbUrlInput ? sbUrlInput.value.trim() : '';
        const key = sbKeyInput ? sbKeyInput.value.trim() : '';
        const project = sbProjectInput ? sbProjectInput.value.trim() : '';
        const framework = sbFrameworkSelect ? sbFrameworkSelect.value : 'nextjs';
        const customPrefix = sbCustomPrefixInput ? sbCustomPrefixInput.value.trim() : '';

        if (!url || !key || !project) {
            App.showToast('لطفاً همه فیلدهای اجباری را پر کنید.');
            return;
        }

        // Quick client check
        if (window.supabase) {
            try {
                // Initialize client test
                window.supabase.createClient(url, key);
            } catch (err) {
                App.showToast('آدرس یا کلید Supabase نامعتبر است.');
                return;
            }
        }

        const config = { url, key, project, framework, customPrefix };
        localStorage.setItem('supabase_config', JSON.stringify(config));
        
        App.showToast('پیکربندی Supabase با موفقیت ذخیره شد.');
        updateSupabaseUI();
    });

    // Disconnect Action
    sbDisconnectBtn?.addEventListener('click', () => {
        if (confirm('آیا مطمئن هستید که می‌خواهید اتصال Supabase را قطع کنید؟')) {
            localStorage.removeItem('supabase_config');
            App.showToast('اتصال با Supabase قطع شد.');
            updateSupabaseUI();
        }
    });

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
        const storedConfig = localStorage.getItem('supabase_config');
        if (!storedConfig) {
            App.showToast('پیکربندی فعال Supabase یافت نشد.');
            return;
        }

        const config = JSON.parse(storedConfig);
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
            
            const sbClient = window.supabase.createClient(config.url, config.key);
            
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

