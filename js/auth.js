let isSignupMode = false;

const authForm = document.getElementById('authForm');
const toggleAuth = document.getElementById('toggleAuth');
const authTitle = document.getElementById('authTitle');
const submitBtn = document.getElementById('submitBtn');
const toggleText = document.getElementById('toggleText');

if (toggleAuth) {
    toggleAuth.addEventListener('click', (event) => {
        event.preventDefault();
        isSignupMode = !isSignupMode;
        authTitle.textContent = isSignupMode ? 'ایجاد حساب کاربری' : 'کدلیب';
        submitBtn.textContent = isSignupMode ? 'ثبت نام' : 'ورود';
        toggleAuth.textContent = isSignupMode ? 'وارد شوید' : 'ایجاد حساب کاربری';
        toggleText.textContent = isSignupMode ? 'حساب دارید؟ ' : 'تازه وارد هستید؟ ';
    });
}

authForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const action = isSignupMode ? 'signup' : 'login';

    if (App.isSupabaseActive()) {
        const sb = App.getSupabaseClient();
        if (!sb) {
            alert('پایگاه داده ابری Supabase در حال لود شدن است. لطفاً چند لحظه دیگر دوباره تلاش کنید.');
            return;
        }

        const email = username.includes('@') ? username : `${username}@codolib.local`;

        try {
            if (isSignupMode) {
                // SignUp Mode
                const { data, error } = await sb.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            display_name: username,
                            avatar_url: '',
                            bio: ''
                        }
                    }
                });

                if (error) throw error;

                const user = data.user;
                if (user) {
                    const formattedUser = {
                        id: user.id,
                        username: username,
                        display_name: username,
                        avatar_url: '',
                        bio: ''
                    };
                    localStorage.setItem('currentUser', formattedUser.username);
                    localStorage.setItem('currentProfile', JSON.stringify(formattedUser));
                    App.showToast('ثبت نام با موفقیت انجام شد.');
                    setTimeout(() => { location.href = 'dashboard.html'; }, 1000);
                }
            } else {
                // Login Mode
                const { data, error } = await sb.auth.signInWithPassword({ email, password });
                if (error) throw error;

                const user = data.user;
                if (user) {
                    const usernameOnly = user.email.split('@')[0];
                    const formattedUser = {
                        id: user.id,
                        username: usernameOnly,
                        display_name: user.user_metadata?.display_name || usernameOnly,
                        avatar_url: user.user_metadata?.avatar_url || '',
                        bio: user.user_metadata?.bio || ''
                    };
                    localStorage.setItem('currentUser', formattedUser.username);
                    localStorage.setItem('currentProfile', JSON.stringify(formattedUser));
                    location.href = 'dashboard.html';
                }
            }
        } catch (error) {
            console.error('Supabase Auth error:', error);
            alert(error.message || 'خطا در احراز هویت با دیتابیس ابری.');
        }
    } else {
        // Fallback to PHP local backend
        try {
            const response = await fetch(`api/auth.php?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (data.status === 'success') {
                localStorage.setItem('currentUser', data.user.username);
                localStorage.setItem('currentProfile', JSON.stringify(data.user));
                location.href = 'dashboard.html';
            } else {
                alert(data.message || 'درخواست انجام نشد');
            }
        } catch (error) {
            console.error('Auth error:', error);
            alert('اتصال به سرور برقرار نشد.');
        }
    }
});

async function checkAuth() {
    if (App.isSupabaseActive()) {
        const sb = App.getSupabaseClient();
        if (!sb) {
            // Script might still be loading, wait and retry once
            setTimeout(checkAuth, 300);
            return;
        }

        try {
            const { data, error } = await sb.auth.getUser();
            if (data?.user) {
                const user = data.user;
                const usernameOnly = user.email.split('@')[0];
                const formattedUser = {
                    id: user.id,
                    username: usernameOnly,
                    display_name: user.user_metadata?.display_name || usernameOnly,
                    avatar_url: user.user_metadata?.avatar_url || '',
                    bio: user.user_metadata?.bio || ''
                };
                localStorage.setItem('currentUser', formattedUser.username);
                localStorage.setItem('currentProfile', JSON.stringify(formattedUser));
            } else if (isProtectedPage()) {
                location.href = 'login.html';
            }
        } catch (error) {
            console.error('Supabase checkAuth error:', error);
            if (isProtectedPage()) location.href = 'login.html';
        }
    } else {
        // Fallback to PHP local backend
        try {
            const response = await fetch('api/auth.php?action=check');
            const data = await response.json();
            if (data.status === 'success') {
                localStorage.setItem('currentUser', data.user.username);
                localStorage.setItem('currentProfile', JSON.stringify(data.user));
            } else if (isProtectedPage()) {
                location.href = 'login.html';
            }
        } catch (error) {
            console.error('Auth check error:', error);
        }
    }
}

checkAuth();

function isProtectedPage() {
    const path = location.pathname.split('/').pop();
    return ['dashboard.html', 'editor.html', 'profile.html', 'settings.html'].includes(path);
}
