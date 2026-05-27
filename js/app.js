// Shared utilities and state management
const App = {
    showToast: (message, duration = 3000) => {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, duration);
    },

    getCurrentUser: () => {
        return localStorage.getItem('currentUser') || 'کاربر مهمان';
    },

    getCurrentProfile: () => {
        try {
            return JSON.parse(localStorage.getItem('currentProfile')) || {};
        } catch (error) {
            return {};
        }
    },

    logout: async () => {
        try {
            if (App.isSupabaseActive()) {
                const sb = App.getSupabaseClient();
                if (sb) await sb.auth.signOut();
            } else {
                await fetch('api/auth.php?action=logout');
            }
            localStorage.removeItem('currentUser');
            localStorage.removeItem('currentProfile');
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    },

    initTheme: () => {
        const theme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        App.updateThemeIcon(theme);
    },

    toggleTheme: () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        App.updateThemeIcon(newTheme);
    },

    updateThemeIcon: (theme) => {
        const icon = document.querySelector('#themeToggle i');
        if (icon) {
            icon.className = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
};

let supabaseClient = null;

App.isSupabaseActive = () => {
    return localStorage.getItem('supabase_config') !== null;
};

App.getSupabaseClient = () => {
    if (!supabaseClient && App.isSupabaseActive()) {
        try {
            const config = JSON.parse(localStorage.getItem('supabase_config'));
            if (window.supabase) {
                supabaseClient = window.supabase.createClient(config.url, config.key);
            }
        } catch (e) {
            console.error('Failed to init Supabase client:', e);
        }
    }
    return supabaseClient;
};

// Dynamically load Supabase script if active and not already present
if (App.isSupabaseActive() && !window.supabase && !document.getElementById('supabase-cdn-script')) {
    const script = document.createElement('script');
    script.id = 'supabase-cdn-script';
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = false;
    document.head.appendChild(script);
}

App.initTheme();

document.addEventListener('DOMContentLoaded', () => {
    const profile = App.getCurrentProfile();
    const display = document.getElementById('usernameDisplay');
    if (display) display.textContent = profile.display_name || App.getCurrentUser();

    const avatar = document.getElementById('userAvatar');
    if (avatar && profile.avatar_url) {
        avatar.innerHTML = `<img src="${profile.avatar_url}" alt="" style="width: 100%; height: 100%; object-fit: cover;">`;
    }

    document.getElementById('logoutBtn')?.addEventListener('click', (event) => {
        event.preventDefault();
        App.logout();
    });

    document.getElementById('themeToggle')?.addEventListener('click', (event) => {
        event.preventDefault();
        App.toggleTheme();
    });

    const profileMenuToggle = document.getElementById('profileMenuToggle');
    const profileMenu = document.getElementById('profileMenu');
    profileMenuToggle?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        profileMenu?.classList.toggle('open');
    });

    profileMenu?.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    document.addEventListener('click', () => {
        profileMenu?.classList.remove('open');
    });
});
