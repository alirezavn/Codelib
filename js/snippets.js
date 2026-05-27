const getSnippets = async () => {
    if (App.isSupabaseActive()) {
        const sb = App.getSupabaseClient();
        if (sb) {
            try {
                const profile = App.getCurrentProfile();
                const { data, error } = await sb
                    .from('snippets')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return data.map(item => ({
                    ...item,
                    tags: item.tags || [],
                    history_count: 1
                })) || [];
            } catch (err) {
                console.error('Supabase getSnippets error:', err);
                return [];
            }
        }
    }
    const response = await fetch('api/snippets.php');
    const data = await response.json();
    return data.snippets || [];
};

if (document.getElementById('snippetGrid')) {
    renderSnippets();
    document.getElementById('searchInput')?.addEventListener('input', (event) => {
        renderSnippets(event.target.value);
    });
}

async function renderSnippets(query = '') {
    const grid = document.getElementById('snippetGrid');
    const snippets = await getSnippets();
    const filtered = snippets.filter((snippet) =>
        snippet.title.toLowerCase().includes(query.toLowerCase()) ||
        snippet.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase())) ||
        snippet.language.toLowerCase().includes(query.toLowerCase())
    );

    grid.innerHTML = filtered.map((snippet) => `
        <div class="snippet-card glass fade-in" onclick="location.href='editor.html?id=${snippet.id}'">
            <div class="snippet-header">
                <span class="tag">${snippet.language}</span>
                <div style="display: flex; gap: 0.8rem; align-items: center;">
                    ${snippet.visibility === 'public' ? '<i class="fas fa-globe" title="عمومی" style="font-size: 0.8rem; color: var(--accent-primary);"></i>' : ''}
                    <i class="fas fa-share-alt" style="color: var(--text-dim); cursor: pointer;" onclick="event.stopPropagation(); shareSnippet('${snippet.id}')"></i>
                    <i class="fas fa-code" style="color: var(--text-dim);"></i>
                </div>
            </div>
            <h3 class="snippet-title">${snippet.title}</h3>
            ${snippet.forked_from_id ? `<p class="fork-origin"><i class="fas fa-code-branch"></i> فورک شده از ${snippet.forked_from_author ? `${snippet.forked_from_author} / ` : ''}${snippet.forked_from_title || 'قطعه اصلی'}</p>` : ''}
            <p class="snippet-desc">${snippet.description}</p>
            <div class="snippet-footer">
                <span>${new Date(snippet.created_at).toLocaleDateString('fa-IR')}</span>
                <div class="snippet-stats">
                    <span class="stat-pill"><i class="fas fa-code-branch"></i>${snippet.fork_count || 0}</span>
                    <span style="opacity: 0.7;">${snippet.history_count} نسخه</span>
                </div>
            </div>
        </div>
    `).join('');

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim);">هیچ قطعه کدی پیدا نشد.</p>';
    }
}

const editor = {
    title: document.getElementById('snippetTitle'),
    lang: document.getElementById('snippetLanguage'),
    tags: document.getElementById('snippetTags'),
    code: document.getElementById('codeEditor'),
    desc: document.getElementById('snippetDesc'),
    saveBtn: document.getElementById('saveBtn'),
    deleteBtn: document.getElementById('deleteBtn'),
    historyList: document.getElementById('historyList'),
    currentId: null
};

let codeMirrorEditor = null;
let latestSavedCode = '';
let activeHistoryKey = 'latest';
let currentHistory = [];

function normalizeLanguage(language = '') {
    const value = language.toLowerCase().trim();
    if (value === 'js' || value === 'javascript') return 'javascript';
    if (value === 'html' || value === 'markup') return 'html';
    if (value === 'css') return 'css';
    if (value === 'php') return 'php';
    return 'text';
}

function getCodeMirrorMode(language) {
    switch (normalizeLanguage(language)) {
        case 'php': return 'application/x-httpd-php';
        case 'html': return 'htmlmixed';
        case 'css': return 'css';
        case 'javascript': return 'javascript';
        default: return 'text/plain';
    }
}

function getPrismLanguage(language) {
    switch (normalizeLanguage(language)) {
        case 'php': return 'php';
        case 'html': return 'markup';
        case 'css': return 'css';
        case 'javascript': return 'javascript';
        default: return 'plain';
    }
}

function escapeHtml(value = '') {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getEditorValue() {
    return codeMirrorEditor ? codeMirrorEditor.getValue() : editor.code?.value || '';
}

function setEditorValue(value) {
    if (codeMirrorEditor) {
        codeMirrorEditor.setValue(value || '');
    } else if (editor.code) {
        editor.code.value = value || '';
    }
}

function updateEditorLanguage(language) {
    const normalized = normalizeLanguage(language);
    if (editor.lang) editor.lang.value = normalized;
    if (codeMirrorEditor) codeMirrorEditor.setOption('mode', getCodeMirrorMode(normalized));
}

if (editor.code && window.CodeMirror) {
    codeMirrorEditor = CodeMirror.fromTextArea(editor.code, {
        mode: getCodeMirrorMode(editor.lang?.value),
        theme: 'dracula',
        lineNumbers: true,
        lineWrapping: localStorage.getItem('lineWrap') !== 'false',
        indentUnit: Number(localStorage.getItem('tabSize') || 4),
        tabSize: Number(localStorage.getItem('tabSize') || 4)
    });
}

editor.lang?.addEventListener('change', (event) => {
    updateEditorLanguage(event.target.value);
});

async function loadSnippetForEditing(id) {
    if (App.isSupabaseActive()) {
        const sb = App.getSupabaseClient();
        if (sb) {
            try {
                const queryId = isNaN(id) ? id : Number(id);
                const { data, error } = await sb
                    .from('snippets')
                    .select('*')
                    .eq('id', queryId)
                    .single();
                if (error) throw error;

                editor.currentId = data.id;
                editor.title.value = data.title;
                updateEditorLanguage(data.language);
                editor.tags.value = (data.tags || []).join(', ');
                setEditorValue(data.code);
                latestSavedCode = data.code || '';
                activeHistoryKey = 'latest';
                currentHistory = [];
                editor.desc.value = data.description || '';
                if (document.getElementById('snippetVisibility')) {
                    document.getElementById('snippetVisibility').value = data.visibility || localStorage.getItem('defaultVisibility') || 'private';
                }
                document.getElementById('editorHeader').textContent = 'ویرایش قطعه کد';
                renderHistory(currentHistory);
                return;
            } catch (err) {
                console.error('Supabase loadSnippetForEditing error:', err);
                App.showToast('خطا در بارگذاری قطعه کد از ابر.');
                return;
            }
        }
    }
    const response = await fetch(`api/snippets.php?id=${id}`);
    const data = await response.json();
    if (data.status !== 'success') return;
    const snippet = data.snippet;

    editor.currentId = id;
    editor.title.value = snippet.title;
    updateEditorLanguage(snippet.language);
    editor.tags.value = snippet.tags.join(', ');
    setEditorValue(snippet.code);
    latestSavedCode = snippet.code || '';
    activeHistoryKey = 'latest';
    currentHistory = snippet.history || [];
    editor.desc.value = snippet.description;
    if (document.getElementById('snippetVisibility')) {
        document.getElementById('snippetVisibility').value = snippet.visibility || localStorage.getItem('defaultVisibility') || 'private';
    }
    document.getElementById('editorHeader').textContent = 'ویرایش قطعه کد';
    renderHistory(currentHistory);
}

window.shareSnippet = async (id) => {
    let snippet;
    if (id) {
        const response = await fetch(`api/snippets.php?id=${id}`);
        const data = await response.json();
        snippet = data.snippet;
    } else {
        snippet = {
            title: editor.title.value,
            code: getEditorValue(),
            language: editor.lang.value,
            desc: editor.desc.value
        };
    }

    if (!snippet.code) {
        App.showToast('ابتدا کدی را وارد کنید.');
        return;
    }

    const shareData = btoa(unescape(encodeURIComponent(JSON.stringify({
        t: snippet.title,
        c: snippet.code,
        l: snippet.language,
        d: snippet.description || snippet.desc
    }))));

    const url = `${window.location.origin}${window.location.pathname.replace(/\/[^\/]*$/, '/editor.html')}?share=${shareData}`;
    navigator.clipboard.writeText(url).then(() => App.showToast('لینک اشتراک گذاری کپی شد.'));
};

document.getElementById('shareBtn')?.addEventListener('click', () => shareSnippet(editor.currentId));

const urlParams = new URLSearchParams(window.location.search);
const shareData = urlParams.get('share');
if (shareData) {
    try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(shareData))));
        document.addEventListener('DOMContentLoaded', () => {
            if (editor.title) {
                editor.title.value = decoded.t;
                setEditorValue(decoded.c);
                updateEditorLanguage(decoded.l);
                editor.desc.value = decoded.d;
                document.getElementById('editorHeader').textContent = 'قطعه کد اشتراک گذاری شده';
                App.showToast('قطعه کد بارگذاری شد.');
            }
        });
    } catch (error) {
        console.error('Error decoding shared snippet', error);
    }
} else if (urlParams.get('id')) {
    loadSnippetForEditing(urlParams.get('id'));
}

async function renderExplorer(query = '') {
    const grid = document.getElementById('explorerGrid');
    if (!grid) return;

    let allPublic = [];
    if (App.isSupabaseActive()) {
        const sb = App.getSupabaseClient();
        if (sb) {
            try {
                const { data, error } = await sb
                    .from('snippets')
                    .select('*')
                    .eq('visibility', 'public')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                allPublic = data.map(item => ({
                    ...item,
                    author: item.author || 'کاربر ابری',
                    fork_count: item.fork_count || 0
                })) || [];
            } catch (err) {
                console.error('Supabase renderExplorer error:', err);
            }
        }
    } else {
        const response = await fetch('api/snippets.php?type=public');
        const data = await response.json();
        allPublic = data.snippets || [];
    }

    const filtered = allPublic.filter((snippet) =>
        snippet.title.toLowerCase().includes(query.toLowerCase()) ||
        snippet.language.toLowerCase().includes(query.toLowerCase())
    );

    grid.innerHTML = filtered.map((snippet) => `
        <div class="snippet-card glass fade-in">
            <div class="snippet-header">
                <span class="tag">${snippet.language}</span>
                <span style="font-size: 0.8rem; color: var(--text-dim);">توسط ${snippet.author || 'ناشناس'}</span>
            </div>
            <h3 class="snippet-title">${snippet.title}</h3>
            <p class="snippet-desc">${snippet.description || ''}</p>
            <div style="margin-bottom: 1.5rem; max-height: 100px; overflow: hidden; position: relative;">
                <pre class="code-preview"><code class="language-${getPrismLanguage(snippet.language)}">${escapeHtml(snippet.code)}</code></pre>
                <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 30px; background: linear-gradient(transparent, var(--bg-card));"></div>
            </div>
            <div class="snippet-footer">
                <div class="snippet-actions">
                    <button class="btn btn-secondary btn-sm" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="forkSnippet('${snippet.id}')">
                        <i class="fas fa-code-branch"></i> فورک ${snippet.fork_count || 0}
                    </button>
                    <button class="btn btn-secondary btn-sm" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="copyToLibrary('${btoa(unescape(encodeURIComponent(JSON.stringify(snippet))))}')">
                        <i class="fas fa-copy"></i> کپی
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    if (window.Prism) Prism.highlightAll();
}

if (document.getElementById('explorerGrid')) {
    renderExplorer();
    document.getElementById('explorerSearch')?.addEventListener('input', (event) => {
        renderExplorer(event.target.value);
    });
}

window.copyToLibrary = async (dataStr) => {
    const snippet = JSON.parse(decodeURIComponent(escape(atob(dataStr))));
    const newSnippet = {
        title: snippet.title,
        language: snippet.language,
        description: snippet.description || snippet.desc || '',
        code: snippet.code,
        tags: snippet.tags || [],
        visibility: 'private'
    };

    if (App.isSupabaseActive()) {
        const sb = App.getSupabaseClient();
        if (sb) {
            try {
                const profile = App.getCurrentProfile();
                const { error } = await sb.from('snippets').insert([{
                    title: newSnippet.title,
                    language: newSnippet.language,
                    description: newSnippet.description,
                    code: newSnippet.code,
                    tags: newSnippet.tags,
                    visibility: newSnippet.visibility,
                    user_id: profile.id
                }]);
                if (error) throw error;
                App.showToast('قطعه کد به کتابخانه شما اضافه شد.');
                return;
            } catch (err) {
                console.error('Supabase copyToLibrary error:', err);
                App.showToast('خطا در کپی قطعه کد به ابر.');
                return;
            }
        }
    }

    const response = await fetch('api/snippets.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: newSnippet.title,
            language: newSnippet.language,
            desc: newSnippet.description,
            code: newSnippet.code,
            tags: newSnippet.tags,
            visibility: newSnippet.visibility
        })
    });
    const data = await response.json();
    if (data.status === 'success') App.showToast('قطعه کد به کتابخانه شما اضافه شد.');
};

window.forkSnippet = async (snippetId) => {
    if (App.isSupabaseActive()) {
        const sb = App.getSupabaseClient();
        if (sb) {
            try {
                const profile = App.getCurrentProfile();
                const queryId = isNaN(snippetId) ? snippetId : Number(snippetId);
                const { data: source, error: loadErr } = await sb
                    .from('snippets')
                    .select('*')
                    .eq('id', queryId)
                    .single();
                if (loadErr) throw loadErr;

                const { error: forkErr } = await sb.from('snippets').insert([{
                    title: `${source.title} (فورک)`,
                    language: source.language,
                    description: source.description,
                    code: source.code,
                    visibility: 'private',
                    forked_from_id: source.id,
                    user_id: profile.id
                }]);
                if (forkErr) throw forkErr;

                App.showToast('قطعه کد با موفقیت فورک شد.');
                await renderExplorer(document.getElementById('explorerSearch')?.value || '');
                return;
            } catch (err) {
                console.error('Supabase forkSnippet error:', err);
                App.showToast('خطا در فورک قطعه کد.');
                return;
            }
        }
    }

    const response = await fetch('api/snippets.php?action=fork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippet_id: snippetId })
    });
    const data = await response.json();
    if (data.status === 'success') {
        App.showToast('قطعه کد با موفقیت فورک شد.');
        await renderExplorer(document.getElementById('explorerSearch')?.value || '');
    }
};

function renderHistory(history) {
    if (!editor.historyList) return;
    const previousVersions = history.slice(0, -1).reverse();
    editor.historyList.innerHTML = `
        <li class="history-item ${activeHistoryKey === 'latest' ? 'active' : ''}" onclick="restoreLatestVersion()">
            <span style="font-weight: 500;">آخرین نسخه ذخیره شده</span>
        </li>
        ${previousVersions.map((item, index) => {
            const versionNumber = history.length - index - 1;
            return `
                <li class="history-item ${activeHistoryKey === `version-${versionNumber}` ? 'active' : ''}" onclick="restoreVersion('${item.code.replace(/'/g, "\\'")}', ${versionNumber})">
                    <span style="font-weight: 500;">نسخه ${versionNumber}</span>
                    <span class="history-time">${new Date(item.time).toLocaleString('fa-IR')}</span>
                </li>
            `;
        }).join('')}
    `;
}

window.restoreLatestVersion = () => {
    activeHistoryKey = 'latest';
    setEditorValue(latestSavedCode);
    renderHistory(currentHistory);
    App.showToast('آخرین نسخه دوباره نمایش داده شد.');
};

window.restoreVersion = (code, versionNumber) => {
    activeHistoryKey = `version-${versionNumber}`;
    setEditorValue(code);
    renderHistory(currentHistory);
    App.showToast('پیش نمایش نسخه انتخاب شده فعال شد.');
};

editor.saveBtn?.addEventListener('click', async () => {
    const snippetData = {
        id: editor.currentId,
        title: editor.title.value || 'قطعه کد بدون نام',
        language: normalizeLanguage(editor.lang.value || 'text'),
        tags: editor.tags.value.split(',').map((tag) => tag.trim()).filter((tag) => tag),
        code: getEditorValue(),
        desc: editor.desc.value,
        visibility: document.getElementById('snippetVisibility')?.value || 'private'
    };

    if (App.isSupabaseActive()) {
        const sb = App.getSupabaseClient();
        if (sb) {
            try {
                const profile = App.getCurrentProfile();
                const sbSnippet = {
                    title: snippetData.title,
                    language: snippetData.language,
                    description: snippetData.desc,
                    code: snippetData.code,
                    visibility: snippetData.visibility,
                    tags: snippetData.tags,
                    user_id: profile.id
                };

                if (snippetData.id) {
                    const queryId = isNaN(snippetData.id) ? snippetData.id : Number(snippetData.id);
                    const { error } = await sb
                        .from('snippets')
                        .update(sbSnippet)
                        .eq('id', queryId);
                    if (error) throw error;
                } else {
                    const { error } = await sb
                        .from('snippets')
                        .insert([sbSnippet]);
                    if (error) throw error;
                }

                App.showToast('قطعه کد با موفقیت ذخیره شد.');
                setTimeout(() => location.href = 'dashboard.html', 1000);
                return;
            } catch (err) {
                console.error('Supabase Save Snippet error:', err);
                App.showToast('خطا در ذخیره قطعه کد در دیتابیس ابری.');
                return;
            }
        }
    }

    const response = await fetch('api/snippets.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snippetData)
    });
    const data = await response.json();
    if (data.status === 'success') {
        App.showToast('قطعه کد با موفقیت ذخیره شد.');
        setTimeout(() => location.href = 'dashboard.html', 1000);
    }
});

editor.deleteBtn?.addEventListener('click', async () => {
    if (confirm('آیا از حذف این قطعه کد مطمئن هستید؟')) {
        if (App.isSupabaseActive()) {
            const sb = App.getSupabaseClient();
            if (sb) {
                try {
                    const queryId = isNaN(editor.currentId) ? editor.currentId : Number(editor.currentId);
                    const { error } = await sb
                        .from('snippets')
                        .delete()
                        .eq('id', queryId);
                    if (error) throw error;
                    location.href = 'dashboard.html';
                    return;
                } catch (err) {
                    console.error('Supabase Delete Snippet error:', err);
                    App.showToast('خطا در حذف قطعه کد از دیتابیس ابری.');
                    return;
                }
            }
        }

        const response = await fetch(`api/snippets.php?id=${editor.currentId}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.status === 'success') location.href = 'dashboard.html';
    }
});
