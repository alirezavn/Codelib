const profileForm = document.getElementById('profileForm');
const displayNameInput = document.getElementById('displayName');
const avatarUrlInput = document.getElementById('avatarUrl');
const bioInput = document.getElementById('bio');
const namePreview = document.getElementById('profileNamePreview');
const usernamePreview = document.getElementById('profileUsernamePreview');
const bioPreview = document.getElementById('profileBioPreview');
const avatarPreview = document.getElementById('profileAvatarPreview');

async function loadProfile() {
    if (App.isSupabaseActive()) {
        const profile = App.getCurrentProfile();
        applyProfile(profile);
        return;
    }

    const response = await fetch('api/auth.php?action=profile');
    const data = await response.json();
    if (data.status === 'success') applyProfile(data.user);
}

function applyProfile(profile) {
    displayNameInput.value = profile.display_name || '';
    avatarUrlInput.value = profile.avatar_url || '';
    bioInput.value = profile.bio || '';
    namePreview.textContent = profile.display_name || profile.username;
    usernamePreview.textContent = `@${profile.username}`;
    bioPreview.textContent = profile.bio || 'هنوز توضیحی ثبت نشده است.';
    avatarPreview.innerHTML = profile.avatar_url
        ? `<img src="${profile.avatar_url}" alt="" style="width: 100%; height: 100%; object-fit: cover;">`
        : '<i class="fas fa-user"></i>';
}

profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (App.isSupabaseActive()) {
        const sb = App.getSupabaseClient();
        if (sb) {
            try {
                const { data, error } = await sb.auth.updateUser({
                    data: {
                        display_name: displayNameInput.value,
                        avatar_url: avatarUrlInput.value,
                        bio: bioInput.value
                    }
                });

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
                    localStorage.setItem('currentProfile', JSON.stringify(formattedUser));
                    applyProfile(formattedUser);
                    App.showToast('پروفایل ذخیره شد.');
                }
                return;
            } catch (err) {
                console.error('Supabase profile update error:', err);
                App.showToast('خطا در بروزرسانی پروفایل در ابر.');
                return;
            }
        }
    }

    const response = await fetch('api/auth.php?action=profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            display_name: displayNameInput.value,
            avatar_url: avatarUrlInput.value,
            bio: bioInput.value
        })
    });
    const data = await response.json();
    if (data.status === 'success') {
        localStorage.setItem('currentProfile', JSON.stringify(data.user));
        applyProfile(data.user);
        App.showToast('پروفایل ذخیره شد.');
    }
});

loadProfile();
